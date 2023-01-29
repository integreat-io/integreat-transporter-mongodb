import ava, { TestFn } from 'ava'
import {
  uri,
  openMongoWithCollection,
  closeMongo,
  insertDocuments,
  deleteDocuments,
  MongoElements,
} from './helpers/mongo.js'
import { TypedData } from 'integreat'

import transporter from '../index.js'

const test = ava as TestFn<MongoElements>

// Helpers

const options = { uri }
const authentication = null
const emit = () => undefined

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
    {
      _id: 'entry:ent1',
      id: 'ent1',
      '\\$type': 'entry',
      date: new Date('2021-03-14T18:43:11Z'),
    },
    {
      _id: 'entry:ent2',
      id: 'ent2',
      '\\$type': 'entry',
      date: new Date('2021-03-14T18:51:09Z'),
    },
  ])
  const action = {
    type: 'GET',
    payload: {
      type: 'entry',
      id: 'ent1',
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
    authentication,
    null,
    emit
  )
  const response = await transporter.send(action, connection)
  await transporter.disconnect(connection)

  t.truthy(response)
  t.is(response.status, 'ok', response.error)
  const data = response.data as TypedData[]
  t.is(data.length, 1)
  t.is(data[0].id, 'ent1')
  t.deepEqual(data[0].date, new Date('2021-03-14T18:43:11Z'))
})

test('should get documents by type', async (t) => {
  const { collection, collectionName } = t.context
  await insertDocuments(collection, [
    { _id: 'entry:ent1', id: 'ent1', '\\$type': 'entry' },
    { _id: 'entry:ent2', id: 'ent2', '\\$type': 'entry' },
  ])
  const action = {
    type: 'GET',
    payload: {
      type: 'entry',
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
    authentication,
    null,
    emit
  )
  const response = await transporter.send(action, connection)
  await transporter.disconnect(connection)

  t.truthy(response)
  t.is(response.status, 'ok', response.error)
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
  const action = {
    type: 'GET',
    payload: {
      type: 'entry',
    },
    meta: {
      options: {
        collection: collectionName,
        db: 'test',
        query: [
          { path: 'type', op: 'eq', param: 'type' },
          { path: 'attributes.title', value: 'Entry 2' },
        ],
      },
    },
  }

  const connection = await transporter.connect(
    options,
    authentication,
    null,
    emit
  )
  const response = await transporter.send(action, connection)
  await transporter.disconnect(connection)

  t.truthy(response)
  t.is(response.status, 'ok', response.error)
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
  const action = {
    type: 'GET',
    payload: {
      type: 'entry',
    },
    meta: {
      options: {
        collection: collectionName,
        db: 'test',
        sort: {
          'attributes.index': 1,
        },
      },
    },
  }

  const connection = await transporter.connect(
    options,
    authentication,
    null,
    emit
  )
  const response = await transporter.send(action, connection)
  await transporter.disconnect(connection)

  t.truthy(response)
  t.is(response.status, 'ok', response.error)
  const data = response.data as TypedData[]
  t.is(data.length, 3)
  t.is(data[0].id, 'ent3')
  t.is(data[1].id, 'ent1')
  t.is(data[2].id, 'ent2')
})
