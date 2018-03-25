import test from 'ava'
import {
  dbUri,
  openMongoWithCollection,
  closeMongo,
  insertDocuments,
  // getDocuments,
  deleteDocuments
} from './helpers/mongo'

import adapter from '..'

// Helpers

const sourceOptions = {dbUri}

// Tests

test('get a document by type and id', async (t) => {
  const {client, collection, collectionName} = await openMongoWithCollection('test')
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

  deleteDocuments(collection, {type: 'entry'})
  closeMongo(client)
})

test('get documents by type', async (t) => {
  const {client, collection, collectionName} = await openMongoWithCollection('test')
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

  deleteDocuments(collection, {type: 'entry'})
  closeMongo(client)
})
