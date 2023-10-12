import debug from 'debug'
import { FindCursor, AggregationCursor, MongoClient } from 'mongodb'
import { Action, Response, TypedData } from 'integreat'
import prepareFilter from './utils/prepareFilter.js'
import prepareAggregation from './utils/prepareAggregation.js'
import createPaging from './utils/createPaging.js'
import { normalizeItem } from './utils/serialize.js'
import { getCollection } from './send.js'
import { decodePageId, DecodedPageId } from './utils/pageId.js'
import { isObject } from './utils/is.js'
import {
  MongoOptions,
  Payload,
  AggregationObject,
  QueryObject,
} from './types.js'

const debugMongo = debug('integreat:transporter:mongodb')

type Cursor = FindCursor | AggregationCursor

interface ItemWithIdObject extends Record<string, unknown> {
  _id: Record<string, unknown>
}

const normalizeId = (data: TypedData[], useIdAsInternalId: boolean) =>
  useIdAsInternalId
    ? data.map(({ _id, id, ...item }) => ({ ...item, id: _id ?? id })) // Fall back to `id` if `_id` is not present
    : data

const getId = (data: Record<string, unknown>, useIdAsInternalId: boolean) =>
  useIdAsInternalId ? data._id : data.id

// Move the cursor to the first doc after the `pageAfter`
// When no `pageAfter`, just start from the beginning
const moveToData = async (
  cursor: Cursor,
  useIdAsInternalId: boolean,
  pageAfter?: string | Record<string, unknown>,
) => {
  if (!pageAfter) {
    // Start from the beginning
    return true
  }

  let doc
  do {
    doc = await cursor.next()
  } while (doc && getId(doc, useIdAsInternalId) !== pageAfter)
  // TODO: Compare objects with deep equal

  return !!doc // false if the doc to start after is not found
}

const explodeId = ({ _id, ...item }: ItemWithIdObject) => ({ ...item, ..._id })

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
  { pageSize = Infinity, pageOffset, pageAfter }: Payload,
  pageId?: DecodedPageId,
) => {
  if (typeof pageOffset === 'number') {
    cursor.skip(pageOffset)
  } else {
    const after = pageAfter || pageId?.id

    // When pageAfter is set – loop until we find the doc with that `id`
    debugMongo('Moving to cursor %s', after)
    const foundFirst = await moveToData(cursor, useIdAsInternalId, after)

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
  } = options as MongoOptions
  const filter = prepareFilter(query, params, pageId, useIdAsInternalId)
  const sort = prepareSort((options as MongoOptions).sort, useIdAsInternalId)

  const aggregation = aggregationObjects
    ? prepareAggregation(
        appendToAggregation(aggregationObjects, query, sort),
        params,
        true, // addDefaultSorting,
        useIdAsInternalId,
      )
    : undefined

  let cursor
  if (aggregation) {
    debugMongo('Starting query with aggregation %o', aggregation)
    cursor = collection.aggregate(aggregation, { allowDiskUse })
  } else {
    debugMongo('Starting query with filter %o', filter)
    cursor = collection.find(filter, { allowDiskUse })
    debugMongo('Sorting with %o', sort)
    cursor = cursor.sort(sort ?? { _id: 1 })
  }

  debugMongo('Getting page')
  const data = await getPage(cursor, useIdAsInternalId, payload, pageId)
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
      const countFilter = prepareFilter(query, params)
      totalCount = await collection.countDocuments(countFilter)
    }
  }

  debugMongo('Normalizing data')
  const normalizedData = normalizeId(
    data.map(normalizeItem) as TypedData[],
    useIdAsInternalId,
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
