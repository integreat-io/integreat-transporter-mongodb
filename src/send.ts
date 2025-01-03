import { Action, Response } from 'integreat'
import { Collection, MongoClient } from 'mongodb'
import getDocs from './getDocs.js'
import setDocs from './setDocs.js'
import { Connection, ServiceOptions } from './types.js'

export const getCollection = (
  action: Action,
  client: MongoClient,
): Collection | undefined => {
  const options = action.meta?.options as ServiceOptions | undefined
  if (!options?.collection) {
    return undefined
  }
  const db = client.db(options?.db)
  return db?.collection(options.collection)
}

// Extract `idIsUnique`, unless `appendOnly` is true
const extractIdIsUnique = (action: Action) =>
  !!action.meta?.options?.idIsUnique && !action.meta?.options?.appendOnly

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
  const useIdAsInternalId = extractIdIsUnique(action)

  switch (action.type) {
    case 'GET':
      return getDocs(action, client, useIdAsInternalId)
    case 'SET':
    case 'UPDATE':
    case 'DELETE':
      return setDocs(action, client, useIdAsInternalId)
  }

  return { ...action.response, status: 'noaction' }
}
