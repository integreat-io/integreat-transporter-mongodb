import debug = require('debug')
import { FindCursor, AggregationCursor, MongoClient } from 'mongodb'
import { Action, Response, TypedData } from 'integreat'
import prepareFilter from './prepareFilter.js'
import prepareAggregation from './prepareAggregation.js'
import createPaging from './createPaging.js'
import { normalizeItem } from './escapeKeys.js'
import { getCollection } from './send.js'
import { atob } from './utils/base64.js'
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

// Move the cursor to the first doc after the `pageAfter`
// When no `pageAfter`, just start from the beginning
const moveToData = async (cursor: Cursor, pageAfter?: string) => {
  if (!pageAfter) {
    // Start from the beginning
    return true
  }

  let doc
  do {
    doc = await cursor.next()
  } while (doc && doc.id !== pageAfter)

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
const pageAfterFromPageId = (pageId?: string) =>
  typeof pageId === 'string' ? pageId.split('|')[0] : undefined

const getPage = async (
  cursor: Cursor,
  { pageSize = Infinity, pageOffset, pageAfter, pageId }: Payload
) => {
  if (typeof pageOffset === 'number') {
    cursor.skip(pageOffset)
  } else {
    const after = pageAfter || pageAfterFromPageId(atob(pageId))

    // When pageAfter is set – loop until we find the doc with that `id`
    debugMongo('Moving to cursor %s', after)
    const foundFirst = await moveToData(cursor, after)

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
  sort?: Record<string, 1 | -1>
) =>
  [
    query ? { type: 'query', query } : undefined,
    sort ? { type: 'sort', sortBy: sort } : undefined,
    ...aggregation,
  ].filter(Boolean) as AggregationObject[]

const paramsFromPayload = ({ data, ...payload }: Payload) => payload

export default async function getDocs(
  action: Action,
  client: MongoClient
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

  const request = action.payload
  const options = action.meta?.options as MongoOptions
  const params = paramsFromPayload(action.payload)

  debugMongo('Incoming options %o', options)
  debugMongo('Incoming params %o', params)

  const filter = prepareFilter(options.query, params)
  const sort = options.sort
  const allowDiskUse = options.allowDiskUse || false

  const aggregation = options.aggregation
    ? prepareAggregation(
        appendToAggregation(options.aggregation, options.query, options.sort),
        params
      )
    : undefined

  let cursor
  if (aggregation) {
    if (typeof request.pageSize === 'number') {
      return {
        ...action.response,
        status: 'badrequest',
        error: 'Paging is not allowed with aggregations',
      }
    }
    debugMongo('Starting query with aggregation %o', aggregation)
    cursor = collection.aggregate(aggregation, { allowDiskUse })
  } else {
    debugMongo('Starting query with filter %o', filter)
    cursor = collection.find(filter, { allowDiskUse })
    if (sort) {
      debugMongo('Sorting with %o', sort)
      cursor = cursor.sort(sort)
    }
  }

  debugMongo('Getting page')
  const data = await getPage(cursor, request)
  debugMongo('Got result page with %s items', data.length)

  if (data.length === 0 && request.id) {
    return {
      ...action.response,
      status: 'notfound',
      error: `Could not find '${request.id}' of type '${request.type}'`,
    }
  }

  let totalCount = data.length
  if (!aggregation && typeof request.pageSize === 'number') {
    debugMongo('Counting documents')
    totalCount = await collection.countDocuments(filter)
  }

  debugMongo('Normalizing data')
  const normalizedData = data.map(normalizeItem) as TypedData[]

  const response = {
    ...action.response,
    status: 'ok',
    data: normalizedData,
    meta: { totalCount },
  }

  if (request.pageSize) {
    debugMongo('Creating paging')
    response.paging = createPaging(data, request, options.sort)
  }

  return response
}
