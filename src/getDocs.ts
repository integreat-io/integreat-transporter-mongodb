import debug = require('debug')
import prepareFilter from './prepareFilter'
import createPaging from './createPaging'
import { Cursor, MongoClient } from 'mongodb'
import { Exchange, Data } from 'integreat'
import { MongoOptions, ExchangeRequest } from '.'
import { normalizeItem } from './escapeKeys'
import { getCollection } from './send'
import { atob } from './utils/base64'

const debugMongo = debug('great:transporter:mongo')

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
  } while (doc && doc._id !== pageAfter)

  return !!doc // false if the doc to start after is not found
}

// Get one page of docs from where the cursor is
const getData = async (cursor: Cursor, pageSize: number) => {
  const data = []

  while (data.length < pageSize) {
    const doc = await cursor.next()
    if (!doc) {
      break
    }
    data.push(doc)
  }

  return data
}
const pageAfterFromPageId = (pageId?: string) =>
  typeof pageId === 'string' ? pageId.split('|')[0] : undefined

const getPage = async (
  cursor: Cursor,
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

  const filter = prepareFilter(
    options.query,
    request.type,
    request.id,
    request.params
  )
  debugMongo('Starting query with filter %o', filter)
  let cursor = await collection.find(filter)
  if (options.sort) {
    debugMongo('Sorting with %o', options.sort)
    cursor = cursor.sort(options.sort)
  }
  debugMongo('Getting page', filter)
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
