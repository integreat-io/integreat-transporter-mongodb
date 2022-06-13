import ava, { TestFn } from 'ava'
import {
  uri,
  openMongoWithCollection,
  closeMongo,
  insertDocuments,
  getDocuments,
  deleteDocuments,
  MongoElements,
} from './helpers/mongo'

import transporter from '..'
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
  await deleteDocuments(collection, { '\\$type': 'entry' })
  closeMongo(client)
})

// Tests

test('should delete one document', async (t) => {
  const { collection, collectionName } = t.context
  await insertDocuments(collection, [
    { _id: 'entry:ent1', id: 'ent1', '\\$type': 'entry' },
    { _id: 'entry:ent2', id: 'ent2', '\\$type': 'entry' },
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
    emit
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
    { _id: 'entry:ent1', id: 'ent1', '\\$type': 'entry' },
    { _id: 'entry:ent2', id: 'ent2', '\\$type': 'entry' },
  ])
  const action = {
    type: 'DELETE',
    payload: {
      data: [
        { $type: 'entry', id: 'ent1' },
        { $type: 'entry', id: 'ent2' },
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
    emit
  )
  const response = await transporter.send(action, connection)
  await transporter.disconnect(connection)

  t.truthy(response)
  t.is(response.status, 'ok')
  const docs = await getDocuments(collection, { '\\$type': 'entry' })
  t.is(docs.length, 0)
})
