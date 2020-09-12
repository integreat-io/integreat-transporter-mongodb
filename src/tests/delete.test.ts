import ava, { TestInterface } from 'ava'
import {
  uri,
  openMongoWithCollection,
  closeMongo,
  insertDocuments,
  getDocuments,
  deleteDocuments,
  MongoElements,
} from './helpers/mongo'
import defaultExchange from './helpers/defaultExchange'

import adapter from '..'
import { TypedData } from 'integreat'

const test = ava as TestInterface<MongoElements>

// Helpers

const options = { uri }
const authorization = null

test.beforeEach(async (t) => {
  t.context = await openMongoWithCollection('test')
})

test.afterEach.always(async (t) => {
  const { client, collection } = t.context
  deleteDocuments(collection, { '\\$type': 'entry' })
  closeMongo(client)
})

// Tests

test('should delete one document', async (t) => {
  const { collection, collectionName } = t.context
  await insertDocuments(collection, [
    { _id: 'entry:ent1', id: 'ent1', '\\$type': 'entry' },
    { _id: 'entry:ent2', id: 'ent2', '\\$type': 'entry' },
  ])
  const exchange = {
    ...defaultExchange,
    type: 'DELETE',
    request: {
      data: {
        $type: 'entry',
        id: 'ent1',
      },
    },
    options: {
      collection: collectionName,
      db: 'test',
    },
  }

  const connection = await adapter.connect(options, authorization, null)
  const response = await adapter.send(exchange, connection)
  await adapter.disconnect(connection)

  t.truthy(response)
  t.is(response.status, 'ok')
  const docs = (await getDocuments(collection, {
    '\\$type': 'entry',
  })) as TypedData[]
  t.is(docs.length, 1)
  t.is(docs[0].id, 'ent2')
})

test('should delete array of documents', async (t) => {
  const { collection, collectionName } = t.context
  await insertDocuments(collection, [
    { _id: 'entry:ent1', id: 'ent1', '\\$type': 'entry' },
    { _id: 'entry:ent2', id: 'ent2', '\\$type': 'entry' },
  ])
  const exchange = {
    ...defaultExchange,
    type: 'DELETE',
    request: {
      data: [
        { $type: 'entry', id: 'ent1' },
        { $type: 'entry', id: 'ent2' },
      ],
    },
    options: {
      collection: collectionName,
      db: 'test',
    },
  }

  const connection = await adapter.connect(options, authorization, null)
  const response = await adapter.send(exchange, connection)
  await adapter.disconnect(connection)

  t.truthy(response)
  t.is(response.status, 'ok')
  const docs = await getDocuments(collection, { '\\$type': 'entry' })
  t.is(docs.length, 0)
})
