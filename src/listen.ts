import { useInternalIdIfObject } from './getDocs.js'
import type {
  Dispatch,
  Action,
  Response,
  AuthenticateExternal,
} from 'integreat'
import type { ChangeStream } from 'mongodb'
import type { Connection, ChangeStreamEvent } from './types.js'

const setIdentOrErrorOnAction = (
  action: Action,
  response: Response,
): Action => ({
  ...action,
  ...(response.status !== 'ok' ? { response } : {}),
  meta: { ...action.meta, ident: response.access?.ident },
})

const prepareIncomingData = (data: unknown, useIdAsInternalId: boolean) =>
  useIdAsInternalId ? useInternalIdIfObject(data) : data

const shouldHandleEvent = (
  event: ChangeStreamEvent,
  useIdAsInternalId: boolean,
) =>
  ['insert', 'update', 'delete'].includes(event.operationType) &&
  (event.operationType !== 'delete' || useIdAsInternalId)

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
    useIdAsInternalId = false,
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

export default async function listen(
  dispatch: Dispatch,
  connection: Connection | null,
  authenticate: AuthenticateExternal,
): Promise<Response> {
  const { client } = connection?.mongo || {}
  const { db: dbName, collections } = connection?.incoming || {}
  if (!client) {
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
  const listener = createListener(
    dispatch,
    authenticate,
    connection?.idIsUnique,
  )

  for (const collectionId of collections) {
    const changeStream = db
      .collection(collectionId)
      .watch([], { fullDocument: 'updateLookup' })
    pushStream(connection!, changeStream)
    changeStream.on('change', listener)
  }

  return { status: 'ok' }
}
