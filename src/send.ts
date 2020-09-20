import getDocs from './getDocs'
import setDocs from './setDocs'
import { Exchange } from 'integreat'
import { MongoConnection, MongoOptions } from '.'
import { Collection, MongoClient } from 'mongodb'

export const getCollection = (
  exchange: Exchange,
  client: MongoClient
): Collection | undefined => {
  const options = exchange.options as MongoOptions | undefined
  if (!options?.collection) {
    return undefined
  }
  const db = client.db(options?.db)
  return db?.collection(options.collection)
}

export default async function send(
  exchange: Exchange,
  connection: MongoConnection | null
): Promise<Exchange> {
  if (!exchange.options) {
    return {
      ...exchange,
      status: 'badrequest',
      response: { ...exchange.response, error: 'No endpoint options' },
    }
  }
  const client = connection?.client
  if (connection?.status !== 'ok' || !client) {
    return {
      ...exchange,
      status: 'error',
      response: { ...exchange.response, error: 'No valid connection' },
    }
  }

  switch (exchange.type) {
    case 'GET':
      return getDocs(exchange, client)
    case 'SET':
    case 'DELETE':
      return setDocs(exchange, client)
  }

  return { ...exchange, status: 'noaction' }
}
