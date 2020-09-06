import prepareFilter from './prepareFilter'
import getDocs from './getDocs'
import { Exchange, TypedData } from 'integreat'
import { MongoConnection, MongoOptions } from '.'
import { Collection } from 'mongodb'

const createItemResponse = (
  { id, $type }: TypedData,
  status = 'ok',
  error = null
) => ({ $type, id, status, ...(error ? { error } : {}) })

const returnOkOrError = (
  data: TypedData[],
  exchange: Exchange,
  actionName: string
) => {
  const hasError = data.some((item) => item.status !== 'ok')
  return !hasError
    ? { ...exchange, status: 'ok', response: { ...exchange.response, data } }
    : {
        ...exchange,
        status: 'error',
        response: {
          ...exchange.response,
          error: `Error ${actionName} item(s) in mongodb`,
          data: data,
        },
      }
}

const performOnObjectOrArray = async (
  exchange: Exchange,
  data: TypedData | TypedData[],
  fn: (item: TypedData) => Promise<TypedData>
) => {
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

const setOrDeleteData = async (
  getCollection: () => Collection | undefined,
  exchange: Exchange
) => {
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

  const {
    request: { data, params },
  } = exchange

  const performOne = async (item: TypedData) => {
    const filter = prepareFilter(exchange.options, item.$type, item.id, params)
    const _id = `${item.$type}:${item.id}`
    try {
      if (exchange.type === 'SET') {
        await collection.updateOne(
          filter,
          { $set: { ...item, _id } },
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

  return performOnObjectOrArray(
    exchange,
    data as TypedData | TypedData[],
    performOne
  )
}

export default async function send(
  exchange: Exchange,
  connection: MongoConnection | null
): Promise<Exchange> {
  const client = connection?.client
  if (connection?.status !== 'ok' || !client) {
    return {
      ...exchange,
      status: 'error',
      response: { ...exchange.response, error: 'No valid connection' },
    }
  }

  const getCollection = () => {
    const options: MongoOptions | undefined = exchange.options
    if (!options?.collection) {
      return undefined
    }
    const db = client.db(options?.db)
    return db?.collection(options.collection)
  }

  switch (exchange.type) {
    case 'GET':
      return getDocs(getCollection, exchange)
    case 'SET':
    case 'DELETE':
      return setOrDeleteData(getCollection, exchange)
  }

  return { ...exchange, status: 'noaction' }
}
