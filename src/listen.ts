import debug from 'debug'
import { useInternalIdIfObject } from './getDocs.js'
import type {
  Dispatch,
  Action,
  Response,
  AuthenticateExternal,
} from 'integreat'
import type { ChangeStream } from 'mongodb'
import type { Connection, ChangeStreamEvent } from './types.js'

const debugMongo = debug('integreat:transporter:mongodb:client')

const setIdentOrErrorOnAction = (
  action: Action,
  response: Response,
): Action => ({
  ...action,
  ...(response.status !== 'ok' ? { response } : {}),
  meta: { ...action.meta, ident: response.access?.ident },
})

const shouldHandleEvent = (
  event: ChangeStreamEvent,
  useIdAsInternalId: boolean,
) =>
  ['insert', 'update', 'delete'].includes(event.operationType) &&
  (event.operationType !== 'delete' || useIdAsInternalId)

const prepareIncomingData = (data: unknown, useIdAsInternalId: boolean) =>
  useIdAsInternalId ? useInternalIdIfObject(data) : data

function createIncomingAction(
  event: ChangeStreamEvent,
  useIdAsInternalId: boolean,
) {
  const {
    operationType,
    fullDocument,
    ns: { db, coll },
    documentKey: { _id: id } = {},
  } = event
  const [type, payload] =
    operationType === 'delete'
      ? ['DELETE', { id }]
      : ['SET', { data: prepareIncomingData(fullDocument, useIdAsInternalId) }]
  return {
    type,
    payload: { ...payload, method: operationType, collection: coll, db },
  }
}

const createListener =
  (
    dispatch: Dispatch,
    authenticate: AuthenticateExternal,
    useIdAsInternalId: boolean,
  ) =>
  async (event: ChangeStreamEvent) => {
    if (shouldHandleEvent(event, useIdAsInternalId)) {
      const authentication = { status: 'granted' }
      const action = createIncomingAction(event, useIdAsInternalId)
      const authenticateResponse = await authenticate(authentication, action)
      await dispatch(setIdentOrErrorOnAction(action, authenticateResponse))
    }
  }

function pushStream(connection: Connection, stream: ChangeStream) {
  if (Array.isArray(connection.incoming?.streams)) {
    connection.incoming.streams.push(stream)
  } else {
    connection.incoming = { ...connection.incoming, streams: [stream] }
  }
}

/**
 * The listen function is responsible for setting up a change stream listener
 * for MongoDB collections. It takes in a dispatch function,
 * a connection object, and an authenticate function as inputs. It returns a
 * Response object indicating the status of the operation.
 */
export default async function listen(
  dispatch: Dispatch,
  connection: Connection | null,
  authenticate: AuthenticateExternal,
): Promise<Response> {
  const {
    mongo: { client = undefined } = {},
    incoming: { db: dbName = undefined, collections = undefined } = {},
    emit,
  } = connection || {}

  if (!connection || !client) {
    return {
      status: 'error',
      error: 'No MongoDB client',
    }
  }
  if (typeof dbName !== 'string') {
    return {
      status: 'error',
      error: 'No MongoDB database name in incoming options',
    }
  }
  if (!Array.isArray(collections) || collections.length === 0) {
    return {
      status: 'error',
      error: 'No MongoDB collection name(s) in incoming options',
    }
  }

  const db = client.db(dbName)
  const { idIsUnique = false } = connection || {}
  const listener = createListener(dispatch, authenticate, idIsUnique)

  await Promise.all(
    collections.map(async (collectionId) => {
      const changeStream = db
        .collection(collectionId)
        .watch([], { fullDocument: 'updateLookup' })
      pushStream(connection, changeStream)
      changeStream.on('change', listener)
      changeStream.on('error', (error) => {
        debugMongo(`*** MongoDb stream error: ${error.message}`)
        if (emit) {
          emit('error', new Error(`MongoDb stream error: ${error.message}`))
        }
      })
    }),
  )

  return { status: 'ok' }
}
