import ava, { TestInterface } from 'ava'
import {
  uri,
  openMongoWithCollection,
  closeMongo,
  insertDocuments,
  deleteDocuments,
  MongoElements,
} from './helpers/mongo'
import defaultExchange from './helpers/defaultExchange'
import { TypedData } from 'integreat'

import transporter from '..'

const test = ava as TestInterface<MongoElements>

// Helpers

const options = { uri }
const authentication = null

test.beforeEach(async (t) => {
  t.context = await openMongoWithCollection('test')
})

test.afterEach.always(async (t) => {
  const { client, collection } = t.context
  await deleteDocuments(collection, { '\\$type': 'entry' })
  closeMongo(client)
})

// Tests

test('should get a document by type and id', async (t) => {
  const { collection, collectionName } = t.context
  await insertDocuments(collection, [
    { _id: 'entry:ent1', id: 'ent1', '\\$type': 'entry' },
    { _id: 'entry:ent2', id: 'ent2', '\\$type': 'entry' },
  ])
  const exchange = {
    ...defaultExchange,
    type: 'GET',
    request: {
      type: 'entry',
      id: 'ent1',
    },
    options: {
      collection: collectionName,
      db: 'test',
    },
  }

  const connection = await transporter.connect(options, authentication, null)
  const { status, response } = await transporter.send(exchange, connection)
  await transporter.disconnect(connection)

  t.truthy(response)
  t.is(status, 'ok')
  const data = response.data as TypedData[]
  t.is(data.length, 1)
  t.is(data[0].id, 'ent1')
})

test('should get documents by type', async (t) => {
  const { collection, collectionName } = t.context
  await insertDocuments(collection, [
    { _id: 'entry:ent1', id: 'ent1', '\\$type': 'entry' },
    { _id: 'entry:ent2', id: 'ent2', '\\$type': 'entry' },
  ])
  const exchange = {
    ...defaultExchange,
    type: 'GET',
    request: {
      type: 'entry',
    },
    options: {
      collection: collectionName,
      db: 'test',
    },
  }

  const connection = await transporter.connect(options, authentication, null)
  const { status, response } = await transporter.send(exchange, connection)
  await transporter.disconnect(connection)

  t.truthy(response)
  t.is(status, 'ok')
  const data = response.data as TypedData[]
  t.is(data.length, 2)
  t.is(data[0].id, 'ent1')
  t.is(data[1].id, 'ent2')
})

test('should get a document with endpoint query', async (t) => {
  const { collection, collectionName } = t.context
  await insertDocuments(collection, [
    {
      _id: 'entry:ent1',
      id: 'ent1',
      '\\$type': 'entry',
      attributes: { title: 'Entry 1' },
    },
    {
      _id: 'entry:ent2',
      id: 'ent2',
      '\\$type': 'entry',
      attributes: { title: 'Entry 2' },
    },
  ])
  const exchange = {
    ...defaultExchange,
    type: 'GET',
    request: {
      type: 'entry',
    },
    options: {
      collection: collectionName,
      db: 'test',
      query: [
        { path: 'type', op: 'eq', param: 'type' },
        { path: 'attributes.title', value: 'Entry 2' },
      ],
    },
  }

  const connection = await transporter.connect(options, authentication, null)
  const { status, response } = await transporter.send(exchange, connection)
  await transporter.disconnect(connection)

  t.truthy(response)
  t.is(status, 'ok')
  const data = response.data as TypedData[]
  t.is(data.length, 1)
  t.is(data[0].id, 'ent2')
})

test('should sort documents', async (t) => {
  const { collection, collectionName } = t.context
  await insertDocuments(collection, [
    {
      _id: 'entry:ent1',
      id: 'ent1',
      '\\$type': 'entry',
      attributes: { index: 2 },
    },
    {
      _id: 'entry:ent2',
      id: 'ent2',
      '\\$type': 'entry',
      attributes: { index: 3 },
    },
    {
      _id: 'entry:ent3',
      id: 'ent3',
      '\\$type': 'entry',
      attributes: { index: 1 },
    },
  ])
  const exchange = {
    ...defaultExchange,
    type: 'GET',
    request: {
      type: 'entry',
    },
    options: {
      collection: collectionName,
      db: 'test',
      sort: {
        'attributes.index': 1,
      },
    },
  }

  const connection = await transporter.connect(options, authentication, null)
  const { status, response } = await transporter.send(exchange, connection)
  await transporter.disconnect(connection)

  t.truthy(response)
  t.is(status, 'ok')
  const data = response.data as TypedData[]
  t.is(data.length, 3)
  t.is(data[0].id, 'ent3')
  t.is(data[1].id, 'ent1')
  t.is(data[2].id, 'ent2')
})
