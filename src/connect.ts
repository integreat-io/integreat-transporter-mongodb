import { MongoClient } from 'mongodb'
import { MongoOptions, MongoConnection } from '.'

export default async function connect(
  mongoClient: typeof MongoClient,
  options: MongoOptions,
  connection: MongoConnection | null = null
): Promise<MongoConnection> {
  if (connection) {
    return connection
  }

  const { uri, baseUri } = options
  const mongoUri = uri || baseUri
  if (!mongoUri) {
    return {
      status: 'badrequest',
      error: 'A uri is required when connecting to MongoDb',
    }
  }

  try {
    const client = await mongoClient.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    })
    return { status: 'ok', client }
  } catch (error) {
    return {
      status: 'error',
      error: `Could not connect to MongoDb on ${mongoUri}. Error: ${error.message}`,
    }
  }
}
