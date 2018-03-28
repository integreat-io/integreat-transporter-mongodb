import test from 'ava'
import {
  baseUri,
  openMongoWithCollection,
  closeMongo,
  insertDocuments,
  deleteDocuments
} from './helpers/mongo'

import mongodb from '..'
const {adapter} = mongodb

// Helpers

const sourceOptions = {baseUri}

test.beforeEach(async (t) => {
  t.context = await openMongoWithCollection('test')
})

test.afterEach.always(async (t) => {
  const {client, collection} = t.context
  deleteDocuments(collection, {type: 'entry'})
  closeMongo(client)
})

// Tests

test('get a document by type and id', async (t) => {
  const {collection, collectionName} = t.context
  await insertDocuments(collection, [
    {id: 'ent1', type: 'entry'},
    {id: 'ent2', type: 'entry'}
  ])
  const request = {
    action: 'GET',
    params: {
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
  const {data} = response
  t.is(data.length, 1)
  t.is(data[0].id, 'ent1')
})

test('get documents by type', async (t) => {
  const {collection, collectionName} = t.context
  await insertDocuments(collection, [
    {id: 'ent1', type: 'entry'},
    {id: 'ent2', type: 'entry'}
  ])
  const request = {
    action: 'GET',
    params: {
      type: 'entry'
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
  const {data} = response
  t.is(data.length, 2)
  t.is(data[0].id, 'ent1')
  t.is(data[1].id, 'ent2')
})
