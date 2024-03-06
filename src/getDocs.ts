import assert from 'node:assert/strict'
import debug from 'debug'
import mapAny from 'map-any'
import { getProperty, setProperty } from 'dot-prop'
import prepareFilter from './utils/prepareFilter.js'
import prepareAggregation, {
  extractLookupPaths,
} from './utils/prepareAggregation.js'
import createPaging from './utils/createPaging.js'
import { normalizeItem } from './utils/serialize.js'
import { getCollection } from './send.js'
import { decodePageId } from './utils/pageId.js'
import { isObject } from './utils/is.js'
import type { FindCursor, AggregationCursor, MongoClient } from 'mongodb'
import type { Action, Response } from 'integreat'
import type {
  ServiceOptions,
  Payload,
  AggregationObject,
  QueryObject,
  ParsedPageId,
} from './types.js'

const debugMongo = debug('integreat:transporter:mongodb')

type Cursor = FindCursor | AggregationCursor

interface ItemWithIdObject extends Record<string, unknown> {
  _id: Record<string, unknown>
}

const resolveInternalId = (_id: unknown, id: unknown) =>
  isObject(_id) && id !== undefined
    ? id // When `_id` is an object (i.e. a compund id), and `id` is set, use `id` to not override intentional mapping
    : _id ?? id // Fall back to `id` if `_id` is not present

const useInternalId = ({
  _id,
  id,
  ...item
}: Record<string, unknown>): Record<string, unknown> => ({
  ...item,
  id: resolveInternalId(_id, id),
})

export const useInternalIdIfObject = (item: unknown) =>
  isObject(item) ? useInternalId(item) : item

const normalizeIdInItem = (lookupPaths: string[]) =>
  function normalizeIdInItem(item: unknown) {
    if (!isObject(item)) {
      return item
    }
    // Don't normalize the id if it's an compound id
    const normalized = isObject(item._id) ? item : useInternalId(item)

    if (lookupPaths.length > 0) {
      // Look for lookup paths and normalize the ids in the lookup result
      // We do this even for aggregations
      lookupPaths.forEach((lookupPath) => {
        const value = getProperty(normalized, lookupPath)
        setProperty(
          normalized,
          lookupPath,
          mapAny(useInternalIdIfObject, value),
        )
      })
    }

    return normalized
  }

function normalizeId(
  data: unknown[],
  useIdAsInternalId: boolean,
  lookupPaths: string[],
) {
  if (!useIdAsInternalId) {
    return data
  }
  return data.map(normalizeIdInItem(lookupPaths))
}

const getId = (data: Record<string, unknown>, useIdAsInternalId: boolean) =>
  useIdAsInternalId ? data._id : data.id

function compareIds(a: unknown, b: string | Record<string, unknown>) {
  if (isObject(a) && isObject(b)) {
    try {
      assert.deepEqual(a, b)
      return true
    } catch (err) {
      return false
    }
  }
  return a === b
}

// Move the cursor to the first doc after the `pageAfter`
// When no `pageAfter`, just start from the beginning
const moveToData = async (
  cursor: Cursor,
  useIdAsInternalId: boolean,
  isAggregation: boolean,
  pageAfter?: string | Record<string, unknown>,
) => {
  if (!pageAfter) {
    // Start from the beginning
    return true
  }

  let doc
  do {
    doc = await cursor.next()
  } while (
    doc &&
    !compareIds(
      normalizeItem(getId(doc, useIdAsInternalId || isAggregation)),
      pageAfter,
    )
  )

  return !!doc // false if the doc to start after is not found
}

const explodeId = ({ _id, ...item }: ItemWithIdObject) => ({
  _id,
  ...item,
  ..._id,
})

function mutateItem(item: unknown) {
  if (isObject(item) && isObject(item._id)) {
    if (item._id._bsontype === 'ObjectID') {
      // MongoDb id object
      return { ...item, _id: item._id.toString() }
    } else {
      return explodeId(item as ItemWithIdObject)
    }
  }
  return item
}

// Get one page of docs from where the cursor is
const getData = async (cursor: Cursor, pageSize: number) => {
  const data = []

  while (data.length < pageSize) {
    const doc = await cursor.next()
    if (!doc) {
      break
    }
    data.push(mutateItem(doc))
  }

  return data
}

const getPage = async (
  cursor: Cursor,
  useIdAsInternalId: boolean,
  isAggregation: boolean,
  { pageSize = Infinity, pageOffset, pageAfter }: Payload,
  pageId?: ParsedPageId,
) => {
  if (typeof pageOffset === 'number') {
    cursor.skip(pageOffset)
  } else {
    const after = pageAfter || pageId?.id

    // When pageAfter is set – loop until we find the doc with that `id`
    debugMongo('Moving to cursor %s', after)
    const foundFirst = await moveToData(
      cursor,
      useIdAsInternalId,
      isAggregation,
      after,
    )

    if (!foundFirst) {
      return []
    }
  }

  // Get the number of docs specified with pageSize - or the rest of the docs
  debugMongo('Getting %s items', pageSize)
  return getData(cursor, pageSize)
}

const appendToAggregation = (
  aggregation: AggregationObject[],
  query?: QueryObject[],
  sort?: Record<string, 1 | -1>,
) =>
  [
    query ? { type: 'query', query } : undefined,
    sort ? { type: 'sort', sortBy: sort } : undefined,
    ...aggregation,
  ].filter(Boolean) as AggregationObject[]

const paramsFromPayload = ({ data, ...payload }: Payload) => payload

const prepareSort = (
  sort: Record<string, 1 | -1> | undefined,
  useIdAsInternalId: boolean,
) =>
  !useIdAsInternalId || !sort
    ? sort
    : Object.fromEntries(
        Object.entries(sort).map(([key, value]) => [
          key === 'id' ? '_id' : key,
          value,
        ]),
      )

export default async function getDocs(
  action: Action,
  client: MongoClient,
  useIdAsInternalId = false,
): Promise<Response> {
  const collection = getCollection(action, client)
  if (!collection) {
    debugMongo('Trying to get docs from unknown collection')
    return {
      ...action.response,
      status: 'error',
      error: 'Could not get the collection specified in the request',
    }
  }

  const { payload, meta: { options } = {} } = action
  const params = paramsFromPayload(payload)
  const pageId = decodePageId(payload.pageId)

  debugMongo('Incoming options %o', options)
  debugMongo('Incoming params %o', params)

  const {
    query,
    allowDiskUse = false,
    aggregation: aggregationObjects,
  } = options as ServiceOptions
  const sort = prepareSort((options as ServiceOptions).sort, useIdAsInternalId)

  // Prepare aggregation
  const aggregation = aggregationObjects
    ? prepareAggregation(
        appendToAggregation(aggregationObjects, query, sort),
        params,
        true, // addDefaultSorting,
        useIdAsInternalId,
      )
    : undefined
  const lookupPaths = extractLookupPaths(aggregationObjects)

  let cursor
  if (aggregation) {
    // Run aggregation
    debugMongo('Starting query with aggregation %o', aggregation)
    cursor = collection.aggregate(aggregation, { allowDiskUse })
  } else {
    // Prepare filter and run as query when not an aggregation
    const filter = prepareFilter(query, params, pageId, useIdAsInternalId)
    debugMongo('Starting query with filter %o', filter)
    cursor = collection.find(filter, { allowDiskUse })
    debugMongo('Sorting with %o', sort)
    cursor = cursor.sort(sort ?? { _id: 1 })
  }

  debugMongo('Getting page')
  const data = await getPage(
    cursor,
    useIdAsInternalId,
    !!aggregation,
    payload,
    pageId,
  )
  debugMongo('Got result page with %s items', data.length)

  if (data.length === 0 && payload.id) {
    return {
      ...action.response,
      status: 'notfound',
      error: `Could not find '${payload.id}' of type '${payload.type}'`,
    }
  }

  let totalCount = data.length
  if (typeof payload.pageSize === 'number') {
    debugMongo('Counting documents')
    if (aggregation) {
      totalCount =
        isObject(data[0]) && typeof data[0].__totalCount === 'number'
          ? data[0].__totalCount // This is a special prop added in the aggregation
          : 0
    } else {
      const countFilter = prepareFilter(
        query,
        params,
        undefined,
        useIdAsInternalId,
      )
      totalCount = await collection.countDocuments(countFilter)
    }
  }

  debugMongo('Normalizing data')
  const normalizedData = normalizeId(
    data.map(normalizeItem),
    useIdAsInternalId,
    lookupPaths,
  )

  const response = {
    ...action.response,
    status: 'ok',
    data: normalizedData,
    params: { totalCount },
  }

  if (payload.pageSize) {
    debugMongo('Creating paging')
    response.paging = createPaging(
      normalizedData,
      payload,
      sort,
      aggregationObjects,
    )
  }

  return response
}
