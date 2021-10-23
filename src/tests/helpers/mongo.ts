import mongodb = require('mongodb')
const mongo = mongodb.MongoClient

export interface MongoElements {
  client: mongodb.MongoClient
  collection: mongodb.Collection
  collectionName: string
}

export const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1'

let collectionCount = 1

export async function openMongoWithCollection(
  dbName: string
): Promise<MongoElements> {
  const collectionName = `docs_${Date.now()}_${collectionCount++}`
  const client = await mongo.connect(uri)
  const collection = client.db(dbName).collection(collectionName)
  return { client, collection, collectionName }
}

export function closeMongo(client: mongodb.MongoClient): void {
  client.close()
}

export async function insertDocument(
  collection: mongodb.Collection,
  doc: Record<string, unknown>
): Promise<number> {
  const r = await collection.insertOne(doc)
  return r.insertedId ? 1 : 0
}

export async function insertDocuments(
  collection: mongodb.Collection,
  docs: Record<string, unknown>[]
): Promise<number> {
  const r = await collection.insertMany(docs)
  return r.insertedCount
}

export async function getDocuments(
  collection: mongodb.Collection,
  query: Record<string, unknown>
): Promise<unknown[]> {
  return collection.find(query).toArray()
}

export async function deleteDocuments(
  collection: mongodb.Collection,
  query: Record<string, unknown>
): Promise<unknown> {
  return collection.deleteMany(query)
}
