import prepareFilter from './prepareFilter'
import createPaging from './createPaging'
import { Collection, Cursor } from 'mongodb'
import { Exchange } from 'integreat'
import { MongoOptions, ExchangeRequest } from '.'
import { normalizeItem } from './escapeKeys'

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

const getPage = async (
  cursor: Cursor,
  { pageSize = Infinity, pageAfter }: ExchangeRequest
) => {
  // When pageAfter is set – loop until we find the doc with that _id
  const foundFirst = await moveToData(cursor, pageAfter)

  // Get the number of docs specified with pageSize - or the rest of the docs
  if (foundFirst) {
    return getData(cursor, pageSize)
  }

  return []
}

export default async function getDocs(
  getCollection: () => Collection | undefined,
  exchange: Exchange
): Promise<Exchange> {
  const collection = getCollection()
  if (!collection) {
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
  const options: MongoOptions = exchange.options || {}

  const filter = prepareFilter(
    options,
    request.type,
    request.id,
    request.params
  )
  let cursor = await collection.find(filter)
  if (options.sort) {
    cursor = cursor.sort(options.sort)
  }
  const data = await getPage(cursor, request)

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

  const response = {
    ...exchange,
    status: 'ok',
    response: { ...exchange.response, data: data.map(normalizeItem) },
  }

  if (request.pageSize) {
    response.response.paging = createPaging(data, request, options.sort)
  }

  return response
}
