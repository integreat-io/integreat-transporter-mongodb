/* eslint-disable security/detect-object-injection */
import debug from 'debug'
import createHash from 'object-hash'
import type { MongoClient, MongoClientOptions } from 'mongodb'
import type {
  MongoOptions,
  Connection,
  MongoClientObject,
  IncomingOptions,
} from './types.js'

const debugMongo = debug('integreat:transporter:mongodb:client')

const prepareOptions = (
  options?: Record<string, unknown>,
  auth?: Record<string, unknown> | null,
): MongoClientOptions =>
  ({
    ...options,
    ...(auth && typeof auth.key === 'string' && typeof auth.secret === 'string'
      ? { auth: { username: auth.key, password: auth.secret } }
      : {}),
  }) as MongoClientOptions // Type hack, as MongoClientOptions requires some props that are not really required

let failedHeartbeatCount = 0
const clients: Record<string, MongoClientObject> = {}

async function createOrReuseClient(
  Client: typeof MongoClient,
  mongoUri: string,
  options: MongoClientOptions,
  emit: (eventType: string, ...args: unknown[]) => void,
  throwAfterFailedHeartbeatCount?: number,
): Promise<MongoClientObject | undefined> {
  const hash = createHash({ mongoUri, ...options })
  let clientObject = clients[hash]

  if (clientObject && clientObject.client) {
    clientObject.count += 1
    debugMongo(
      `*** MongoDb Client: Reusing client, count is ${clientObject.count}`,
    )
  } else {
    // Create client if it doesn't exist
    const client = new Client(mongoUri, options)

    if (clientObject) {
      clientObject.client = client
      clientObject.count = 1
      debugMongo('*** MongoDb Client: Created new client, old was closed')
    } else {
      clientObject = { client, count: 1 }
      clients[hash] = clientObject
      debugMongo('*** MongoDb Client: Created new client')
    }

    // Listen to errors
    client.on('error', (error) => {
      debugMongo(`*** MongoDb Client error: ${error.message}`)
      emit('error', new Error(`MongoDb error: ${error.message}`))
    })

    // Count failed heartbeats and throw an error when we reach a set threshold
    client.on('serverHeartbeatFailed', () => {
      debugMongo('*** MongoDb Client: Server heartbeat failed')
      failedHeartbeatCount += 1

      if (
        throwAfterFailedHeartbeatCount &&
        failedHeartbeatCount >= throwAfterFailedHeartbeatCount
      ) {
        throw new Error(
          `MongoDb experienced ${failedHeartbeatCount} failed heartbeats`,
        )
      }
    })

    // Reset failed heartbeat counter when it succeeds
    client.on('serverHeartbeatSucceeded', () => {
      failedHeartbeatCount = 0
    })

    // Connect
    await client.connect()
  }

  return clientObject
}

const prepareIncomingOptions = (incoming: IncomingOptions, db?: string) => ({
  ...incoming,
  db: incoming.db || db,
})

export default async function connect(
  Client: typeof MongoClient,
  options: MongoOptions,
  emit: (eventType: string, ...args: unknown[]) => void,
  auth?: Record<string, unknown> | null,
  connection: Connection | null = null,
): Promise<Connection> {
  if (connection) {
    return connection
  }

  const {
    uri,
    baseUri,
    mongo,
    throwAfterFailedHeartbeatCount,
    idIsUnique = false,
    db,
    incoming,
  } = options
  const mongoUri = uri || baseUri
  if (!mongoUri) {
    return {
      status: 'badrequest',
      error: 'A uri is required when connecting to MongoDb',
    }
  }

  try {
    // Create client
    const client = await createOrReuseClient(
      Client,
      mongoUri,
      prepareOptions(mongo, auth),
      emit,
      throwAfterFailedHeartbeatCount,
    )
    return {
      status: 'ok',
      mongo: client,
      idIsUnique,
      ...(incoming && { incoming: prepareIncomingOptions(incoming, db) }),
      emit, // We include emit here to pass it on to `listen()`. Would be better if Integreat passed it on to the listen() function directly
    }
  } catch (error) {
    return {
      status: 'error',
      error: `Could not connect to MongoDb on ${mongoUri}. Error: ${
        (error as Error).message
      }`,
    }
  }
}
