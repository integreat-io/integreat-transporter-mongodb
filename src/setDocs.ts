/* eslint-disable security/detect-object-injection */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { Action, Response } from 'integreat'
import {
  Collection,
  MongoClient,
  MongoBulkWriteError,
  WriteError,
  UpdateResult,
  DeleteResult,
} from 'mongodb'
import debug from 'debug'
import prepareFilter from './prepareFilter.js'
import { serializeItem } from './escapeKeys.js'
import { isObjectWithId } from './utils/is.js'
import { ensureArray } from './utils/array.js'
import { getCollection } from './send.js'
import { MongoOptions } from './types.js'

interface ItemResponse {
  id?: string
  modifiedCount: number
  insertedCount: number
  deletedCount: number
  status: string
  error?: string
}

interface Operation {
  id: string
  filter: Record<string, unknown>
  update: Record<string, unknown>
}

interface OperationError {
  error: string
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
  oneOrMoreResponses: ItemResponse | ItemResponse[],
  action: Action,
  isDelete: boolean
): Response => {
  const responses = ensureArray(oneOrMoreResponses)
  const errors = responses
    .filter((reponse) => reponse.status !== 'ok')
    .map((response) => [response.id, response.error] as const)
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
      ? {
          error: createErrorFromIds(errors, isDelete ? 'deleting' : 'updating'),
        }
      : {}),
  }
}

const createOkResponse = (
  modifiedCount: number,
  insertedCount: number,
  deletedCount: number,
  id?: string
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

const createOperation = (action: Action) =>
  function createOperation(item: unknown): Operation | OperationError {
    if (!isObjectWithId(item)) {
      return { error: 'Only object data with an id may be sent to MongoDB' }
    }

    const {
      payload: { data, ...params },
    } = action
    const options = action.meta?.options as MongoOptions | undefined
    const id = String(item.id)

    const filter = prepareFilter(options?.query, {
      ...params,
      id: item.id,
    })
    const update = {
      $set: { ...(serializeItem(item) as Record<string, unknown>), id },
    }

    return { filter, update, id }
  }

async function updateOne(
  operation: Operation,
  collection: Collection,
  isDelete: boolean
) {
  try {
    debugMongo(
      '%s with filter %o',
      isDelete ? 'Delete' : 'Update',
      operation.filter
    )
    const result = isDelete
      ? await collection.deleteOne(operation.filter)
      : await collection.updateOne(operation.filter, operation.update, {
          upsert: true,
        })
    return createOkResponse(
      (result as UpdateResult).modifiedCount ?? 0,
      (result as UpdateResult).upsertedCount ?? 0,
      (result as DeleteResult).deletedCount ?? 0
    )
  } catch (error) {
    return createErrorResponse('error', (error as Error).message, operation.id)
  }
}

async function updateBulk(
  operations: Operation[],
  collection: Collection,
  isDelete: boolean
) {
  try {
    debugMongo(
      isDelete ? 'Delete with filters %o' : 'Update with filters %o',
      operations.map((op) => op.filter)
    )
    const bulkOperations = operations.map(({ filter, update }) =>
      isDelete
        ? { deleteOne: { filter } }
        : { updateOne: { filter, update, upsert: true } }
    )
    const result = await collection.bulkWrite(bulkOperations, {
      ordered: false,
    })
    return createOkResponse(
      result.modifiedCount ?? 0,
      result.upsertedCount ?? 0,
      result.deletedCount ?? 0
    )
  } catch (error) {
    const result = (error as MongoBulkWriteError).result
    const okResponse = createOkResponse(
      result.modifiedCount ?? 0,
      result.upsertedCount ?? 0,
      result.deletedCount ?? 0
    )
    const errorResponses = ensureArray(
      (error as MongoBulkWriteError).writeErrors as WriteError | WriteError[]
    ).map(({ index, errmsg }: WriteError) =>
      createErrorResponse(
        'error',
        errmsg || 'Unspecified MongoDB error',
        operations[index].id
      )
    )

    return [okResponse, ...errorResponses]
  }
}

// Update one or many (bulk)
async function update(
  operations: Operation[],
  collection: Collection,
  isDelete: boolean
) {
  if (operations.length === 1) {
    return await updateOne(operations[0] as Operation, collection, isDelete)
  } else {
    return await updateBulk(operations as Operation[], collection, isDelete)
  }
}

export default async function setDocs(
  action: Action,
  client: MongoClient,
  isDelete: boolean
): Promise<Response> {
  // Get the right collection
  const collection = getCollection(action, client)
  if (!collection) {
    return {
      ...action.response,
      status: 'error',
      error: 'Could not get the collection specified in the request',
    }
  }

  // Create operations from data
  const operations = ensureArray(action.payload.data).map(
    createOperation(action)
  )
  if (operations.length === 0) {
    // No operations -- end right away
    return {
      ...action.response,
      status: 'noaction',
      error: 'No items to update',
      data: [],
    }
  }

  // Check if there were any errors while creating operations
  const errors = operations.filter(
    (operation): operation is OperationError =>
      typeof (operation as OperationError).error === 'string'
  )
  if (errors.length > 0) {
    return createResponse(
      errors.map((operation) =>
        createErrorResponse('badrequest', operation.error!)
      ),
      action,
      isDelete
    )
  }

  // All good, let's update
  const responses = await update(
    operations as Operation[],
    collection,
    isDelete
  )
  return createResponse(responses, action, isDelete)
}
