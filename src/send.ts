import getDocs from './getDocs'
import setDocs from './setDocs'
import { Action, Response } from 'integreat'
import { MongoConnection, MongoOptions } from '.'
import { Collection, MongoClient } from 'mongodb'

export const getCollection = (
  action: Action,
  client: MongoClient
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
  connection: MongoConnection | null
): Promise<Response> {
  if (!action.meta?.options) {
    return {
      ...action.response,
      status: 'badrequest',
      error: 'No endpoint options',
    }
  }
  const client = connection?.client
  if (connection?.status !== 'ok' || !client) {
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
    case 'DELETE':
      return setDocs(action, client)
  }

  return { ...action.response, status: 'noaction' }
}
