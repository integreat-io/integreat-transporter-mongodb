import debug = require('debug')
import prepareFilter from './prepareFilter'
import { Action, Response } from 'integreat'
import { Collection, MongoClient } from 'mongodb'
import { serializeItem } from './escapeKeys'
import { isObjectWithId } from './utils/is'
import { getCollection } from './send'
import { MongoOptions } from './types'

interface ItemResponse {
  id?: string
  modifiedCount: number
  insertedCount: number
  deletedCount: number
  status: string
  error?: string
}

const debugMongo = debug('integreat:transporter:mongodb')

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

const createResponse = (
  responses: ItemResponse[],
  action: Action,
  actionName: string
): Response => {
  const errors = responses
    .filter((item) => item.status !== 'ok')
    .map((item) => [item.id, item.error] as const)
  return {
    ...action.response,
    status:
      errors.length === 0
        ? 'ok'
        : responses.length === 1
        ? responses[0].status
        : 'error',
    ...(responses && { data: summarizeResponses(responses) }),
    ...(errors.length > 0
      ? { error: createErrorFromIds(errors, actionName) }
      : {}),
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

const performOne =
  (action: Action, collection: Collection) =>
  async (item: unknown): Promise<ItemResponse> => {
    if (!isObjectWithId(item)) {
      return createErrorResponse(
        'badrequest',
        'Only object data with an id may be sent to MongoDB'
      )
    }
    const {
      type,
      payload: { data, ...params },
    } = action
    const options = action.meta?.options as MongoOptions | undefined
    const filter = prepareFilter(options?.query, {
      ...params,
      type: item.$type,
      id: item.id,
    })
    const _id = [item.$type, item.id].filter(Boolean).join(':')
    try {
      if (type === 'SET') {
        debugMongo('Set with filter %o', filter)
        const ret = await collection.updateOne(
          filter,
          {
            $set: { ...(serializeItem(item) as Record<string, unknown>), _id },
          },
          { upsert: true }
        )
        return createOkResponse(ret.modifiedCount, ret.upsertedCount, 0, _id)
      } else {
        // 'DELETE'
        debugMongo('Delete with filter %o', filter)
        const ret = await collection.deleteOne(filter)
        return createOkResponse(0, 0, ret.deletedCount ?? 0, _id)
      }
    } catch (error) {
      return createErrorResponse('error', (error as Error).message, _id)
    }
  }

const performOnObjectOrArray = async (
  action: Action,
  collection: Collection
): Promise<Response> => {
  const {
    payload: { data },
  } = action
  const fn = performOne(action, collection)
  const actionName = action.type === 'SET' ? 'updating' : 'deleting'
  if (Array.isArray(data)) {
    const responses = await Promise.all(data.map(fn))
    return createResponse(responses, action, actionName)
  } else if (typeof data === 'object' && data !== null) {
    const response = await fn(data)
    return createResponse([response], action, actionName)
  } else {
    return {
      ...action.response,
      status: 'noaction',
      error: 'No items to update',
      data: [],
    }
  }
}

export default async function setDocs(
  action: Action,
  client: MongoClient
): Promise<Response> {
  const collection = getCollection(action, client)
  if (!collection) {
    return {
      ...action.response,
      status: 'error',
      error: 'Could not get the collection specified in the request',
    }
  }

  return performOnObjectOrArray(action, collection)
}
