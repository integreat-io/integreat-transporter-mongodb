import test from 'ava'
import {
  uri,
  openMongoWithCollection,
  closeMongo,
  insertDocument,
  getDocuments,
  deleteDocuments
} from './helpers/mongo'

import mongodb from '..'
const { adapter } = mongodb

// Helpers

const sourceOptions = { uri }

test.beforeEach(async (t) => {
  t.context = await openMongoWithCollection('test')
})

test.afterEach.always(async (t) => {
  const { client, collection } = t.context
  deleteDocuments(collection, { type: 'entry' })
  closeMongo(client)
})

// Tests

test('should set one document', async (t) => {
  const { collection, collectionName } = t.context
  const request = {
    action: 'SET',
    data: {
      type: 'entry',
      id: 'ent1'
    },
    endpoint: {
      collection: collectionName,
      db: 'test'
    }
  }

  const connection = await adapter.connect(sourceOptions)
  const response = await adapter.send(request, connection)
  await adapter.disconnect(connection)

  t.truthy(response)
  t.is(response.status, 'ok')
  const docs = await getDocuments(collection, { _id: 'entry:ent1' })
  t.is(docs.length, 1)
  t.is(docs[0].id, 'ent1')
})

test('should set array of documents', async (t) => {
  const { collection, collectionName } = t.context
  const request = {
    action: 'SET',
    data: [
      { type: 'entry', id: 'ent1' },
      { type: 'entry', id: 'ent2' }
    ],
    endpoint: {
      collection: collectionName,
      db: 'test'
    }
  }

  const connection = await adapter.connect(sourceOptions)
  const response = await adapter.send(request, connection)
  await adapter.disconnect(connection)

  t.truthy(response)
  t.is(response.status, 'ok')
  const docs = await getDocuments(collection, { type: 'entry' })
  t.is(docs.length, 2)
  t.true(docs.some(doc => doc._id === 'entry:ent1'))
  t.true(docs.some(doc => doc._id === 'entry:ent2'))
})

test('should update existing document', async (t) => {
  const { collection, collectionName } = t.context
  await insertDocument(collection, {
    _id: 'entry:ent1',
    id: 'ent1',
    type: 'entry',
    title: 'Entry 1',
    theOld: true
  })
  const request = {
    action: 'SET',
    data: {
      type: 'entry',
      id: 'ent1',
      title: 'Updated entry 1',
      theNew: true
    },
    endpoint: {
      collection: collectionName,
      db: 'test'
    }
  }

  const connection = await adapter.connect(sourceOptions)
  const response = await adapter.send(request, connection)
  await adapter.disconnect(connection)

  t.truthy(response)
  t.is(response.status, 'ok')
  const docs = await getDocuments(collection, { type: 'entry' })
  t.is(docs.length, 1)
  t.is(docs[0].id, 'ent1')
  t.true(docs[0].theNew)
  t.true(docs[0].theOld)
  t.is(docs[0].title, 'Updated entry 1')
})
