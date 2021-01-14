import prepareFilter from './prepareFilter'
import { Exchange, Data } from 'integreat'
import { Collection, MongoClient } from 'mongodb'
import { serializeItem } from './escapeKeys'
import { isObjectWithId } from './utils/is'
import { getCollection } from './send'
import { MongoOptions } from '.'

interface ItemResponse {
  id?: string
  modifiedCount: number
  insertedCount: number
  deletedCount: number
  status: string
  error?: string
}

const summarizeResponses = (responses: ItemResponse[]) =>
  responses.reduce(
    (response, { modifiedCount, insertedCount, deletedCount }) => ({
      modifiedCount: response.modifiedCount + modifiedCount,
      insertedCount: response.insertedCount + insertedCount,
      deletedCount: response.deletedCount + deletedCount,
    }),
    { modifiedCount: 0, insertedCount: 0, deletedCount: 0 }
  )

const createErrorFromIds = (
  errors: (readonly [string | undefined, string | undefined])[],
  actionName: string
) =>
  `Error ${actionName} item${errors.length === 1 ? '' : 's'} ${errors
    .map(([id]) => `'${id ?? '<no id>'}'`)
    .join(', ')} in mongodb: ${errors.map(([_id, error]) => error).join(' | ')}`

const createReturnExchange = (
  responses: ItemResponse[],
  exchange: Exchange,
  actionName: string
): Exchange => {
  const errors = responses
    .filter((item) => item.status !== 'ok')
    .map((item) => [item.id, item.error] as const)
  return {
    ...exchange,
    status:
      errors.length === 0
        ? 'ok'
        : responses.length === 1
        ? responses[0].status
        : 'error',
    response: {
      ...exchange.response,
      ...(responses && { data: summarizeResponses(responses) }),
      ...(errors.length > 0
        ? { error: createErrorFromIds(errors, actionName) }
        : {}),
    },
  }
}

const createOkResponse = (
  modifiedCount: number,
  insertedCount: number,
  deletedCount: number,
  id: string
) => ({
  id,
  modifiedCount,
  insertedCount,
  deletedCount,
  status: 'ok',
})

const createErrorResponse = (status: string, error: string, id?: string) => ({
  id,
  modifiedCount: 0,
  insertedCount: 0,
  deletedCount: 0,
  status,
  error,
})

const performOne = (exchange: Exchange, collection: Collection) => async (
  item: Data
): Promise<ItemResponse> => {
  if (!isObjectWithId(item)) {
    return createErrorResponse(
      'badrequest',
      'Only object data with an id may be sent to MongoDB'
    )
  }
  const {
    type,
    request: { params },
  } = exchange
  const options = exchange.options as MongoOptions
  const filter = prepareFilter(options.query, {
    ...params,
    type: item.$type,
    id: item.id,
  })
  const _id = [item.$type, item.id].filter(Boolean).join(':')
  try {
    if (type === 'SET') {
      const ret = await collection.updateOne(
        filter,
        {
          $set: { ...(serializeItem(item) as Record<string, unknown>), _id },
        },
        { upsert: true }
      )
      return createOkResponse(ret.modifiedCount, ret.upsertedCount, 0, _id)
    } else {
      const ret = await collection.deleteOne(filter)
      return createOkResponse(0, 0, ret.deletedCount ?? 0, _id)
    }
  } catch (error) {
    return createErrorResponse('error', error.message, _id)
  }
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
    return createReturnExchange(responses, exchange, actionName)
  } else if (typeof data === 'object' && data !== null) {
    const response = await fn(data)
    return createReturnExchange([response], exchange, actionName)
  } else {
    return {
      ...exchange,
      status: 'noaction',
      response: { ...exchange.response, error: 'No items to update', data: [] },
    }
  }
}

export default async function setDocs(
  exchange: Exchange,
  client: MongoClient
): Promise<Exchange> {
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
