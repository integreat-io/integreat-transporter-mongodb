/* eslint-disable security/detect-object-injection */
import { Action, Response } from 'integreat'
import {
  Collection,
  MongoClient,
  MongoBulkWriteError,
  WriteError,
  UpdateResult,
  DeleteResult,
  BulkWriteResult,
} from 'mongodb'
import debug from 'debug'
import prepareFilter from './utils/prepareFilter.js'
import { serializeItem } from './utils/serialize.js'
import { ObjectWithId, isObjectWithId } from './utils/is.js'
import { ensureArray } from './utils/array.js'
import { getCollection } from './send.js'
import { MongoOptions } from './types.js'

interface ItemResponse {
  id?: string | string[]
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

const isDelete = (action: Action) => action.type === 'DELETE'
const isUpdate = (action: Action) => action.type === 'UPDATE'

const summarizeResponses = (responses: ItemResponse[]) =>
  responses.reduce(
    (response, { modifiedCount, insertedCount, deletedCount }) => ({
      modifiedCount: response.modifiedCount + modifiedCount,
      insertedCount: response.insertedCount + insertedCount,
      deletedCount: response.deletedCount + deletedCount,
    }),
    { modifiedCount: 0, insertedCount: 0, deletedCount: 0 },
  )

const createErrorFromIds = (
  errors: (readonly [string | string[] | undefined, string | undefined])[],
  actionName: string,
) =>
  `Error ${actionName} item${errors.length === 1 ? '' : 's'} ${errors
    .flatMap(([id]) =>
      id ? ensureArray(id).map((id) => `'${id}'`) : "'<no id>'",
    )
    .join(', ')} in mongodb: ${errors.map(([_id, error]) => error).join(' | ')}`

const createResponse = (
  oneOrMoreResponses: ItemResponse | ItemResponse[],
  action: Action,
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
          error: createErrorFromIds(
            errors,
            isDelete(action) ? 'deleting' : 'updating',
          ),
        }
      : {}),
  }
}

const createOkResponse = (
  results: BulkWriteResult | UpdateResult | DeleteResult,
  id?: string,
) =>
  results
    ? {
        id,
        modifiedCount: (results as UpdateResult).modifiedCount ?? 0,
        insertedCount: (results as UpdateResult).upsertedCount ?? 0,
        deletedCount: (results as DeleteResult).deletedCount ?? 0,
        status: 'ok',
      }
    : // NOTE: We don't really know why MongoDB would not return a result object, but it's better to return an error than not handling it
      {
        status: 'error',
        error: 'No results returned from MongoDB',
        modifiedCount: 0,
        insertedCount: 0,
        deletedCount: 0,
      }

const createErrorResponse = (
  status: string,
  error: string,
  id?: string | string[],
) => ({
  id,
  modifiedCount: 0,
  insertedCount: 0,
  deletedCount: 0,
  status,
  error,
})

const removeId = ({ id, ...item }: ObjectWithId) => item

const createOperation = (action: Action, useIdAsInternalId: boolean) =>
  function createOperation(item: unknown): Operation | OperationError {
    if (!isObjectWithId(item)) {
      return { error: 'Only object data with an id may be sent to MongoDB' }
    }

    const {
      payload: { data, ...params },
      meta: { options: { keepUndefined = false } = {} } = {},
    } = action
    const options = action.meta?.options as MongoOptions | undefined
    const id = String(item.id)
    const idKey = useIdAsInternalId ? '_id' : 'id'

    const filter = prepareFilter(
      options?.query,
      {
        ...params,
        id: item.id,
      },
      undefined,
      useIdAsInternalId,
    )
    const update = {
      $set: {
        ...(serializeItem(removeId(item), keepUndefined === true) as Record<
          string,
          unknown
        >),
        [idKey]: id,
      },
    }

    return { filter, update, id }
  }

const hasQuery = (action: Action) => action.meta?.options?.query

async function deleteWithQuery(
  action: Action,
  collection: Collection,
): Promise<Response> {
  const {
    payload: { data, ...params },
  } = action
  const options = action.meta?.options as MongoOptions | undefined
  const filter = prepareFilter(options?.query, params, undefined)

  if (Object.keys(filter).length === 0) {
    return { status: 'noaction', error: 'No query to delete with' }
  } else {
    try {
      const result = await collection.deleteMany(filter)
      return createOkResponse(result)
    } catch (error) {
      return createErrorResponse('error', (error as Error).message)
    }
  }
}

async function updateOne(
  operation: Operation,
  collection: Collection,
  action: Action,
) {
  try {
    debugMongo(
      '%s with filter %o',
      isDelete(action) ? 'Delete' : 'Update',
      operation.filter,
    )
    if (isUpdate(action)) {
      const count = await collection.countDocuments(operation.filter)
      if (count === 0) {
        return createErrorResponse(
          'notfound',
          'No documents found with the given filter',
          operation.id,
        )
      }
    }

    const result = isDelete(action)
      ? await collection.deleteOne(operation.filter)
      : await collection.updateOne(operation.filter, operation.update, {
          upsert: true,
        })
    return createOkResponse(result)
  } catch (error) {
    return createErrorResponse('error', (error as Error).message, operation.id)
  }
}

async function updateMany(
  operations: Operation[],
  collection: Collection,
  action: Action,
) {
  try {
    debugMongo(
      isDelete(action) ? 'Delete with filters %o' : 'Update with filters %o',
      operations.map((op) => op.filter),
    )

    if (isUpdate(action)) {
      const count = await collection.countDocuments({
        $or: operations.map((op) => op.filter),
      })
      if (count < operations.length) {
        return createErrorResponse(
          'notfound',
          'One or more documents were not found with the given filter',
          operations.map((op) => op.id),
        )
      }
    }

    const bulkOperations = operations.map(({ filter, update }) =>
      isDelete(action)
        ? { deleteOne: { filter } }
        : isUpdate(action)
          ? { updateOne: { filter, update } }
          : { updateOne: { filter, update, upsert: true } },
    )
    const result = await collection.bulkWrite(bulkOperations, {
      ordered: false,
    })
    return createOkResponse(result)
  } catch (error) {
    const result = (error as MongoBulkWriteError).result
    const okResponse = createOkResponse(result)
    const errorResponses = ensureArray(
      (error as MongoBulkWriteError).writeErrors as WriteError | WriteError[],
    ).map(({ index, errmsg }: WriteError) =>
      createErrorResponse(
        'error',
        errmsg || 'Unspecified MongoDB error',
        operations[index].id,
      ),
    )

    return [okResponse, ...errorResponses]
  }
}

// Update one or many (bulk)
async function update(
  operations: Operation[],
  collection: Collection,
  action: Action,
) {
  if (operations.length === 1) {
    return await updateOne(operations[0] as Operation, collection, action)
  } else {
    return await updateMany(operations as Operation[], collection, action)
  }
}

export default async function setDocs(
  action: Action,
  client: MongoClient,
  useIdAsInternalId = false,
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
    createOperation(action, useIdAsInternalId),
  )
  if (operations.length === 0) {
    if (
      operations.length === 0 &&
      action.type === 'DELETE' &&
      hasQuery(action)
    ) {
      return await deleteWithQuery(action, collection)
    } else {
      // No operations -- end right away
      return {
        ...action.response,
        status: 'noaction',
        error: 'No items to update',
        data: [],
      }
    }
  }

  // Check if there were any errors while creating operations
  const errors = operations.filter(
    (operation): operation is OperationError =>
      typeof (operation as OperationError).error === 'string',
  )
  if (errors.length > 0) {
    return createResponse(
      errors.map((operation) =>
        createErrorResponse('badrequest', operation.error!),
      ),
      action,
    )
  }

  // All good, let's update
  const responses = await update(operations as Operation[], collection, action)
  return createResponse(responses, action)
}
