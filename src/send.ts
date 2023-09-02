import { Action, Response } from 'integreat'
import { Collection, MongoClient } from 'mongodb'
import getDocs from './getDocs.js'
import setDocs from './setDocs.js'
import { Connection, MongoOptions } from './types.js'

export const getCollection = (
  action: Action,
  client: MongoClient,
): Collection | undefined => {
  const options = action.meta?.options as MongoOptions | undefined
  if (!options?.collection) {
    return undefined
  }
  const db = client.db(options?.db)
  return db?.collection(options.collection)
}

export default async function send(
  action: Action,
  connection: Connection | null,
): Promise<Response> {
  if (!action.meta?.options) {
    return {
      ...action.response,
      status: 'badrequest',
      error: 'No endpoint options',
    }
  }
  const client = connection?.mongo?.client
  if (!connection || connection.status !== 'ok' || !client) {
    return {
      ...action.response,
      status: 'error',
      error: 'No valid connection',
    }
  }

  switch (action.type) {
    case 'GET':
      return getDocs(action, client)
    case 'SET':
    case 'UPDATE':
    case 'DELETE':
      return setDocs(action, client)
  }

  return { ...action.response, status: 'noaction' }
}
