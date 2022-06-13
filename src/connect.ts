import { MongoClient } from 'mongodb'
import { MongoOptions, Connection } from '.'

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
    const client = new Client(mongoUri, prepareOptions(mongo, auth))
    await client.connect()
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
