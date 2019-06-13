const mongodb = require('mongodb')

const mongo = mongodb.MongoClient
const baseUri = process.env.MONGO_URI || 'mongodb://127.0.0.1'

let collectionCount = 1

async function openMongoWithCollection (dbName = 'test') {
  const collectionName = `docs_${Date.now()}_${collectionCount++}`
  const client = await mongo.connect(baseUri, { useNewUrlParser: true })
  const collection = client.db(dbName).collection(collectionName)
  return {client, collection, collectionName}
}

function closeMongo (client) {
  client.close()
}

async function insertDocument (collection, doc) {
  const r = await collection.insertOne(doc)
  return r.insertedCount
}

async function insertDocuments (collection, docs) {
  const r = await collection.insertMany(docs)
  return r.insertedCount
}

async function getDocuments (collection, query) {
  return collection.find(query).toArray()
}

async function deleteDocuments (collection, query) {
  return collection.deleteMany(query)
}

module.exports = {
  baseUri,
  openMongoWithCollection,
  closeMongo,
  insertDocument,
  insertDocuments,
  getDocuments,
  deleteDocuments
}
