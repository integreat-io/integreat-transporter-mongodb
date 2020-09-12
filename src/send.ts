import prepareFilter from './prepareFilter'
import getDocs from './getDocs'
import { Exchange, TypedData, Data } from 'integreat'
import { MongoConnection, MongoOptions } from '.'
import { Collection, MongoClient } from 'mongodb'
import { serializeItem } from './escapeKeys'
import { isTypedData } from './utils/is'

interface ItemResponse {
  status: string
  error?: string
  $type?: string
  id?: string
}

export const getCollection = (
  exchange: Exchange,
  client: MongoClient
): Collection | undefined => {
  const options = exchange.options as MongoOptions | undefined
  if (!options?.collection) {
    return undefined
  }
  const db = client.db(options?.db)
  return db?.collection(options.collection)
}

const createItemResponse = (
  { id, $type }: TypedData,
  status = 'ok',
  error?: string
): ItemResponse => ({ $type, id, status, ...(error ? { error } : {}) })

const setStatusAndResponse = (
  exchange: Exchange,
  status: string,
  responses?: ItemResponse[],
  error?: string
): Exchange => ({
  ...exchange,
  status,
  response: {
    ...exchange.response,
    ...(responses && { data: (responses as unknown) as Data[] }),
    ...(error && { error }),
  },
})

const returnOkOrError = (
  responses: ItemResponse[],
  exchange: Exchange,
  actionName: string
): Exchange => {
  const hasError = responses.some((item) => item.status !== 'ok')
  return !hasError
    ? setStatusAndResponse(exchange, 'ok', responses)
    : responses.length === 1
    ? setStatusAndResponse(
        exchange,
        responses[0].status,
        undefined,
        `Error ${actionName} item(s) in mongodb: ${responses[0].error}`
      )
    : setStatusAndResponse(
        exchange,
        'error',
        responses,
        `Error ${actionName} item(s) in mongodb`
      )
}

const performOne = (exchange: Exchange, collection: Collection) => async (
  item: Data
): Promise<ItemResponse> => {
  if (!isTypedData(item)) {
    return {
      status: 'badrequest',
      error: 'Only typed data may be sent to MongoDB',
    }
  }
  const {
    type,
    request: { params },
    options,
  } = exchange
  const filter = prepareFilter(
    options as Record<string, unknown>,
    item.$type,
    item.id,
    params
  )
  const _id = `${item.$type}:${item.id}`
  try {
    if (type === 'SET') {
      await collection.updateOne(
        filter,
        {
          $set: { ...(serializeItem(item) as Record<string, unknown>), _id },
        },
        { upsert: true }
      )
    } else {
      await collection.deleteOne(filter)
    }
  } catch (error) {
    return createItemResponse(item, 'error', error.message)
  }
  return createItemResponse(item)
}

const performOnObjectOrArray = async (
  exchange: Exchange,
  collection: Collection
) => {
  const {
    request: { data },
  } = exchange
  const fn = performOne(exchange, collection)
  const actionName = exchange.type === 'SET' ? 'updating' : 'deleting'
  if (Array.isArray(data)) {
    const responses = await Promise.all(data.map(fn))
    return returnOkOrError(responses, exchange, actionName)
  } else if (typeof data === 'object' && data !== null) {
    const response = await fn(data)
    return returnOkOrError([response], exchange, actionName)
  } else {
    return {
      ...exchange,
      status: 'noaction',
      response: { ...exchange.response, error: 'No items to update', data: [] },
    }
  }
}

const setOrDeleteData = async (exchange: Exchange, client: MongoClient) => {
  const collection = getCollection(exchange, client)
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

  return performOnObjectOrArray(exchange, collection)
}

export default async function send(
  exchange: Exchange,
  connection: MongoConnection | null
): Promise<Exchange> {
  if (!exchange.options) {
    return {
      ...exchange,
      status: 'badrequest',
      response: { ...exchange.response, error: 'No endpoint options' },
    }
  }
  const client = connection?.client
  if (connection?.status !== 'ok' || !client) {
    return {
      ...exchange,
      status: 'error',
      response: { ...exchange.response, error: 'No valid connection' },
    }
  }

  switch (exchange.type) {
    case 'GET':
      return getDocs(exchange, client)
    case 'SET':
    case 'DELETE':
      return setOrDeleteData(exchange, client)
  }

  return { ...exchange, status: 'noaction' }
}
