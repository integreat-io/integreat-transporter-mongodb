import debug = require('debug')
import { MongoClient } from 'mongodb'
import { MongoOptions, Connection } from './types'

const debugMongo = debug('integreat:transporter:mongodb:client')

const prepareOptions = (
  options?: Record<string, unknown>,
  auth?: Record<string, unknown> | null
) => ({
  ...options,
  ...(auth && typeof auth.key === 'string' && typeof auth.secret === 'string'
    ? { auth: { username: auth.key, password: auth.secret } }
    : {}),
})

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

  const { uri, baseUri, mongo } = options
  const mongoUri = uri || baseUri
  if (!mongoUri) {
    return {
      status: 'badrequest',
      error: 'A uri is required when connecting to MongoDb',
    }
  }

  try {
    // Create client
    const client = new Client(mongoUri, prepareOptions(mongo, auth))

    // Listen to errors
    client.on('error', (error) => {
      debugMongo(`*** MongoDb Client error: ${error.message}`)
      emit('error', new Error(`MongoDb error: ${error.message}`))
    })
    client.on('serverOpening', () => {
      debugMongo('*** MongoDb Client: Server opening')
    })
    client.on('serverClosed', () => {
      debugMongo('*** MongoDb Client: Server closed')
    })
    client.on('topologyOpening', () => {
      debugMongo('*** MongoDb Client: Topology opening')
    })
    client.on('topologyClosed', () => {
      debugMongo('*** MongoDb Client: Topology closed')
    })
    client.on('serverHeartbeatFailed', () => {
      debugMongo('*** MongoDb Client: Server heartbeat failed')
    })

    // Connect
    await client.connect()

    // Return connection
    return { status: 'ok', client }
  } catch (error) {
    return {
      status: 'error',
      error: `Could not connect to MongoDb on ${mongoUri}. Error: ${
        (error as Error).message
      }`,
    }
  }
}
