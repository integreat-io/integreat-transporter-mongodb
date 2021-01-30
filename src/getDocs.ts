import debug = require('debug')
import prepareFilter from './prepareFilter'
import prepareAggregation from './prepareAggregation'
import createPaging from './createPaging'
import { AggregationCursor, Cursor, MongoClient } from 'mongodb'
import { Exchange, Data } from 'integreat'
import {
  MongoOptions,
  ExchangeRequest,
  AggregationObject,
  QueryObject,
} from '.'
import { normalizeItem } from './escapeKeys'
import { getCollection } from './send'
import { atob } from './utils/base64'
import { isObject } from './utils/is'

const debugMongo = debug('great:transporter:mongo')

interface ItemWithIdObject extends Record<string, unknown> {
  _id: Record<string, unknown>
}

// Move the cursor to the first doc after the `pageAfter`
// When no `pageAfter`, just start from the beginning
const moveToData = async (
  cursor: Cursor | AggregationCursor,
  pageAfter?: string
) => {
  if (!pageAfter) {
    // Start from the beginning
    return true
  }

  let doc
  do {
    doc = await cursor.next()
  } while (doc && doc._id !== pageAfter)

  return !!doc // false if the doc to start after is not found
}

const explodeId = ({ _id, ...item }: ItemWithIdObject) => ({ ...item, ..._id })

const mutateItem = (item: unknown) =>
  isObject(item) && isObject(item._id)
    ? explodeId(item as ItemWithIdObject)
    : item

// Get one page of docs from where the cursor is
const getData = async (
  cursor: Cursor | AggregationCursor,
  pageSize: number
) => {
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
  cursor: Cursor | AggregationCursor,
  { pageSize = Infinity, pageAfter, pageId }: ExchangeRequest
) => {
  const after = pageAfter || pageAfterFromPageId(atob(pageId))
  // When pageAfter is set – loop until we find the doc with that _id
  const foundFirst = await moveToData(cursor, after)

  // Get the number of docs specified with pageSize - or the rest of the docs
  if (foundFirst) {
    return getData(cursor, pageSize)
  }

  return []
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

export default async function getDocs(
  exchange: Exchange,
  client: MongoClient
): Promise<Exchange> {
  const collection = getCollection(exchange, client)
  if (!collection) {
    debugMongo('Trying to get docs from unknown collection')
    return {
      ...exchange,
      status: 'error',
      response: {
        ...exchange.response,
        error: 'Could not get the collection specified in the request',
      },
    }
  }

  const request = exchange.request
  const options = exchange.options as MongoOptions
  const params = { ...request.params, type: request.type, id: request.id }

  debugMongo('Incoming options %o', options)
  debugMongo('Incoming params %o', params)

  const filter = prepareFilter(options.query, params)
  const sort = options.sort

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
        ...exchange,
        status: 'badrequest',
        response: {
          ...exchange.response,
          error: 'Paging is not allowed with aggregations',
        },
      }
    }
    debugMongo('Starting query with aggregation %o', aggregation)
    cursor = await collection.aggregate(aggregation)
  } else {
    debugMongo('Starting query with filter %o', filter)
    cursor = await collection.find(filter)
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
      ...exchange,
      status: 'notfound',
      response: {
        ...exchange.response,
        error: `Could not find '${request.id}' of type '${request.type}'`,
      },
    }
  }

  const response: Exchange = {
    ...exchange,
    status: 'ok',
    response: { ...exchange.response, data: data.map(normalizeItem) as Data[] },
  }

  if (request.pageSize) {
    response.response.paging = createPaging(data, request, options.sort)
  }

  return response
}
