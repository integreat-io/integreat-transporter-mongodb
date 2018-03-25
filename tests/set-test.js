import test from 'ava'
import {
  dbUri,
  openMongoWithCollection,
  closeMongo,
  getDocuments,
  deleteDocuments
} from './helpers/mongo'

import adapter from '..'

// Helpers

const sourceOptions = {dbUri}

test.beforeEach(async (t) => {
  t.context = await openMongoWithCollection('test')
})

test.afterEach.always(async (t) => {
  const {client, collection} = t.context
  deleteDocuments(collection, {type: 'entry'})
  closeMongo(client)
})

// Tests

test('should set one document', async (t) => {
  const {collection, collectionName} = t.context
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

  const connection = await adapter.connect({sourceOptions})
  const response = await adapter.send(request, connection)
  await adapter.disconnect(connection)

  t.truthy(response)
  t.is(response.status, 'ok')
  const docs = await getDocuments(collection, {type: 'entry'})
  t.is(docs.length, 1)
  t.is(docs[0].id, 'ent1')
})

test('should set array of documents', async (t) => {
  const {collection, collectionName} = t.context
  const request = {
    action: 'SET',
    data: [
      {type: 'entry', id: 'ent1'},
      {type: 'entry', id: 'ent2'}
    ],
    endpoint: {
      collection: collectionName,
      db: 'test'
    }
  }

  const connection = await adapter.connect({sourceOptions})
  const response = await adapter.send(request, connection)
  await adapter.disconnect(connection)

  t.truthy(response)
  t.is(response.status, 'ok')
  const docs = await getDocuments(collection, {type: 'entry'})
  t.is(docs.length, 2)
  t.true(docs.some(doc => doc.id === 'ent1'))
  t.true(docs.some(doc => doc.id === 'ent2'))
})
