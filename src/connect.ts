/* eslint-disable security/detect-object-injection */
import debug = require('debug')
import { MongoClient } from 'mongodb'
import createHash = require('object-hash')
import { MongoOptions, Connection, MongoClientObject } from './types'

const debugMongo = debug('integreat:transporter:mongodb:client')

const prepareOptions = (
  options?: Record<string, unknown>,
  auth?: Record<string, unknown> | null
): Record<string, unknown> => ({
  ...options,
  ...(auth && typeof auth.key === 'string' && typeof auth.secret === 'string'
    ? { auth: { username: auth.key, password: auth.secret } }
    : {}),
})

let failedHeartbeatCount = 0
const clients: Record<string, MongoClientObject> = {}

async function createOrReuseClient(
  Client: typeof MongoClient,
  mongoUri: string,
  options: Record<string, unknown>,
  emit: (eventType: string, ...args: unknown[]) => void,
  throwAfterFailedHeartbeatCount?: number
): Promise<MongoClientObject | undefined> {
  const hash = createHash({ mongoUri, ...options })
  let clientObject = clients[hash]

  if (clientObject && clientObject.count > 0 && clientObject.client) {
    clientObject.count += 1
  } else {
    // Create client if it doesn't exist
    const client = new Client(mongoUri, options)

    if (clientObject) {
      clientObject.client = client
      clientObject.count = 1
    } else {
      clientObject = { client, count: 1 }
      clients[hash] = clientObject
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
          `MongoDb experienced ${failedHeartbeatCount} failed heartbeats`
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

export default async function connect(
  Client: typeof MongoClient,
  options: MongoOptions,
  emit: (eventType: string, ...args: unknown[]) => void,
  auth?: Record<string, unknown> | null,
  connection: Connection | null = null
): Promise<Connection> {
  if (connection) {
    return connection
  }

  const { uri, baseUri, mongo, throwAfterFailedHeartbeatCount } = options
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
      throwAfterFailedHeartbeatCount
    )
    return { status: 'ok', mongo: client }
  } catch (error) {
    return {
      status: 'error',
      error: `Could not connect to MongoDb on ${mongoUri}. Error: ${
        (error as Error).message
      }`,
    }
  }
}
