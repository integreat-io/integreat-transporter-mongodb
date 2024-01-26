import ava, { TestFn } from 'ava'
import {
  uri,
  openMongoWithCollection,
  closeMongo,
  insertDocuments,
  getDocuments,
  deleteDocuments,
  MongoElements,
} from './helpers/mongo.js'

import transporter from '../index.js'
import { TypedData } from 'integreat'
const emit = () => undefined

const test = ava as TestFn<MongoElements>

// Helpers

const options = { uri }
const authorization = null

test.beforeEach(async (t) => {
  t.context = await openMongoWithCollection('test')
})

test.afterEach.always(async (t) => {
  const { client, collection } = t.context
  await deleteDocuments(collection, {})
  closeMongo(client)
})

// Tests

test('should delete one document', async (t) => {
  const { collection, collectionName } = t.context
  await insertDocuments(collection, [
    { _id: '12345', id: 'ent1', '\\$type': 'entry' },
    { _id: '12346', id: 'ent2', '\\$type': 'entry' },
  ])
  const action = {
    type: 'DELETE',
    payload: {
      data: {
        $type: 'entry',
        id: 'ent1',
      },
    },
    meta: {
      options: {
        collection: collectionName,
        db: 'test',
      },
    },
  }

  const connection = await transporter.connect(
    options,
    authorization,
    null,
    emit,
  )
  const response = await transporter.send(action, connection)
  await transporter.disconnect(connection)

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
    { _id: '12347', id: 'user1', '\\$type': 'user' },
    { _id: '12348', id: 'user2', '\\$type': 'user' },
  ])
  const action = {
    type: 'DELETE',
    payload: {
      data: [
        { $type: 'user', id: 'user1' },
        { $type: 'user', id: 'user2' },
      ],
    },
    meta: {
      options: {
        collection: collectionName,
        db: 'test',
      },
    },
  }

  const connection = await transporter.connect(
    options,
    authorization,
    null,
    emit,
  )
  const response = await transporter.send(action, connection)
  await transporter.disconnect(connection)

  t.truthy(response)
  t.is(response.status, 'ok')
  const docs = await getDocuments(collection, { '\\$type': 'user' })
  t.is(docs.length, 0)
})

test('should delete with query', async (t) => {
  const { collection, collectionName } = t.context
  await insertDocuments(collection, [
    { _id: '12349', id: 'item1', '\\$type': 'item', deleteIt: 'yes' },
    { _id: '12350', id: 'item2', '\\$type': 'item' },
  ])
  const action = {
    type: 'DELETE',
    payload: {
      type: 'item',
    },
    meta: {
      options: {
        collection: collectionName,
        db: 'test',
        query: [{ path: 'deleteIt', op: 'eq', value: 'yes' }], // Use this when no data
      },
    },
  }

  const connection = await transporter.connect(
    options,
    authorization,
    null,
    emit,
  )
  const response = await transporter.send(action, connection)
  await transporter.disconnect(connection)

  t.truthy(response)
  t.is(response.status, 'ok', response.error)
  const docs = (await getDocuments(collection, {
    '\\$type': 'item',
  })) as TypedData[]
  t.is(docs.length, 1)
  t.is(docs[0].id, 'item2')
})
