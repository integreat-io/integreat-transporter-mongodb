/* eslint-disable security/detect-object-injection */
import debug from 'debug'
import prepareFilter from './utils/prepareFilter.js'
import { serializeItem } from './utils/serialize.js'
import { isObject, isObjectWithId, ObjectWithId } from './utils/is.js'
import { ensureArray } from './utils/array.js'
import { getCollection } from './send.js'
import type { Action, Response } from 'integreat'
import type {
  Collection,
  MongoClient,
  MongoServerError,
  MongoBulkWriteError,
  WriteError,
  InsertOneResult,
  UpdateResult,
  DeleteResult,
  BulkWriteResult,
  AnyBulkWriteOperation,
} from 'mongodb'
import type { ServiceOptions } from './types.js'

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
  filter: Record<string, unknown> | null
  update: Record<string, unknown>
  updateMany?: boolean
}

interface OperationError {
  error: string
}

const debugMongo = debug('integreat:transporter:mongodb')

const isDelete = (action: Action) => action.type === 'DELETE'
const isUpdate = (action: Action) => action.type === 'UPDATE'
const isUpdateMany = (operations: Operation[]) =>
  operations.some((operation) => operation.updateMany === true)

const extractQuery = (action: Action) =>
  Array.isArray(action.meta?.options?.query)
    ? action.meta.options.query
    : undefined

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
  result: BulkWriteResult | UpdateResult | InsertOneResult | DeleteResult,
  id?: string,
) => ({
  id,
  modifiedCount: (result as UpdateResult | BulkWriteResult).modifiedCount ?? 0,
  insertedCount:
    ((result as BulkWriteResult).insertedCount ||
      (result as UpdateResult | BulkWriteResult).upsertedCount) ??
    ((result as InsertOneResult).insertedId ? 1 : 0),
  deletedCount: (result as DeleteResult | BulkWriteResult).deletedCount ?? 0,
  status: 'ok',
})

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

function createUpdateByQueryOperation(
  item: Record<string, unknown>,
  action: Action,
  useIdAsInternalId: boolean,
) {
  const {
    payload: { data, ...params },
    meta: { options: { keepUndefined = false, appendOnly = false } = {} } = {},
  } = action
  const filter = prepareFilter(
    extractQuery(action), // We know we have a query here, or else we wouldn't be here
    params,
    undefined,
    useIdAsInternalId,
    !!appendOnly,
  )
  const update = {
    $set: serializeItem(item, keepUndefined === true) as Record<
      string,
      unknown
    >,
  }

  return { filter, update, updateMany: true }
}

const removeInc = ({ $inc, ...fields }: Record<string, unknown>) => fields

function extractSetAndInc(
  fields: Record<string, unknown>,
): [Record<string, unknown>, Record<string, unknown> | undefined] {
  if (isObject(fields.$inc)) {
    const incFields = fields.$inc
    return [removeInc(fields), incFields]
  } else {
    return [fields, undefined]
  }
}

const createOperation = (action: Action, useIdAsInternalId: boolean) =>
  function createOperation(item: unknown): Operation | OperationError {
    if (!isObjectWithId(item)) {
      return { error: 'Only object data with an id may be sent to MongoDB' }
    }

    const {
      payload: { data, ...params },
      meta: {
        options: { keepUndefined = false, appendOnly = false } = {},
      } = {},
    } = action
    const options = action.meta?.options as ServiceOptions | undefined
    const id = String(item.id)
    const idKey = useIdAsInternalId ? '_id' : 'id'

    const fields = {
      ...(serializeItem(removeId(item), keepUndefined === true) as Record<
        string,
        unknown
      >),
      [idKey]: id,
    }

    const filter = prepareFilter(
      options?.query,
      { ...params, id: item.id },
      undefined,
      useIdAsInternalId,
      !!appendOnly,
    )

    if (filter) {
      const [setFields, incFields] = extractSetAndInc(fields)
      const update = incFields
        ? { $set: setFields, $inc: incFields }
        : { $set: setFields }
      return { filter, update, id }
    } else {
      return { filter, update: fields, id }
    }
  }

function createOperations(
  data: unknown,
  action: Action,
  useIdAsInternalId: boolean,
) {
  const query = extractQuery(action)
  if (
    isUpdate(action) &&
    Array.isArray(query) &&
    query.length > 0 &&
    isObject(data)
  ) {
    return [createUpdateByQueryOperation(data, action, useIdAsInternalId)]
  } else {
    return ensureArray(data).map(createOperation(action, useIdAsInternalId))
  }
}

async function deleteWithQuery(
  action: Action,
  collection: Collection,
): Promise<Response> {
  const {
    payload: { data, ...params },
  } = action
  const options = action.meta?.options as ServiceOptions | undefined
  const filter = prepareFilter(
    options?.query,
    params,
    undefined,
    !!options?.appendOnly,
  )

  if (!filter || Object.keys(filter).length === 0) {
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
    if (!operation.filter) {
      if (isDelete(action)) {
        // TODO: Write a test for this branch
        return createErrorResponse(
          'error',
          'No filter to delete with',
          operation.id,
        )
      } else {
        return createOkResponse(await collection.insertOne(operation.update))
      }
    }
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
        $or: operations.map((op) => op.filter as Record<string, unknown>), // TODO: Filter should never be null here, but should we still handle it?
      })
      if (count < operations.length) {
        return isUpdateMany(operations)
          ? createErrorResponse(
              'noaction',
              'No documents were matched by the given filter',
            )
          : createErrorResponse(
              'notfound',
              'One or more documents were not found with the given filter',
              operations.map((op) => op.id),
            )
      }
    }

    const bulkOperations = operations.map(({ filter, update }) =>
      isDelete(action)
        ? { deleteOne: { filter } }
        : filter
          ? isUpdate(action)
            ? isUpdateMany(operations)
              ? { updateMany: { filter, update } } // Use updateMany if we're updating many, typically with a query
              : { updateOne: { filter, update } } // Use updateOne if we're updating one, typically with an id
            : { updateOne: { filter, update, upsert: true } } // We're upserting, as this may be a new doc or an updated doc
          : { insertOne: { document: update } },
    )
    const result = await collection.bulkWrite(
      bulkOperations as AnyBulkWriteOperation[], // TODO: Filter should never be null here, but should we still handle it?
      { ordered: false },
    )
    return createOkResponse(result)
  } catch (error) {
    // TODO: This is a bit messy ...
    const result = (error as MongoBulkWriteError).result
    const okResponse = result ? createOkResponse(result) : undefined
    const errorResponses = ensureArray(
      ((error as MongoBulkWriteError).writeErrors as
        | WriteError
        | WriteError[]) ?? (error as MongoServerError).errorResponse,
    ).map(({ index, errmsg }: WriteError) =>
      createErrorResponse(
        'error',
        errmsg || 'Unspecified MongoDB error',
        operations[index]?.id,
      ),
    )

    return okResponse ? [okResponse, ...errorResponses] : errorResponses
  }
}

// Update one or many (bulk)
async function update(
  operations: Operation[],
  collection: Collection,
  action: Action,
) {
  if (operations.length === 1 && !operations[0].updateMany) {
    return await updateOne(operations[0], collection, action)
  } else {
    return await updateMany(operations, collection, action)
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
  const operations = createOperations(
    action.payload.data,
    action,
    useIdAsInternalId,
  )
  if (operations.length === 0) {
    if (action.type === 'DELETE' && !!extractQuery(action)) {
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
