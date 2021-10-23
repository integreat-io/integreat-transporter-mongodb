import { MongoClient } from 'mongodb'
import { MongoOptions, MongoConnection } from '.'

export default async function connect(
  Client: typeof MongoClient,
  options: MongoOptions,
  connection: MongoConnection | null = null
): Promise<MongoConnection> {
  if (connection) {
    return connection
  }

  const { uri, baseUri, mongo, allowDiskUse = false } = options
  const mongoUri = uri || baseUri
  if (!mongoUri) {
    return {
      status: 'badrequest',
      error: 'A uri is required when connecting to MongoDb',
    }
  }

  try {
    const client = new Client(mongoUri, mongo)
    await client.connect()
    return { status: 'ok', client, allowDiskUse }
  } catch (error) {
    return {
      status: 'error',
      error: `Could not connect to MongoDb on ${mongoUri}. Error: ${
        (error as Error).message
      }`,
    }
  }
}
