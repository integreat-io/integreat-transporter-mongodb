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
const authorization = null
const emit = () => undefined

test.beforeEach(async (t) => {
  t.context = await openMongoWithCollection('test')
})

test.afterEach.always(async (t) => {
  const { client, collection } = t.context
  await deleteDocuments(collection, {})
  closeMongo(client)
})

// Tests -- pageId

test('should get one page of documents with params for next page', async (t) => {
  const { collection, collectionName } = t.context
  await insertDocuments(collection, [
    { _id: '12345', id: 'ent1' },
    { _id: '12346', id: 'ent2' },
    { _id: '12347', id: 'ent2' },
  ])
  const action = {
    type: 'GET',
    payload: {
      type: 'entry',
      pageSize: 2,
    },
    meta: {
      options: {
        collection: collectionName,
        db: 'test',
      },
    },
  }
  const expectedPaging = {
    next: {
      type: 'entry',
      pageId: 'ZW50Mnw+',
      pageSize: 2,
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

  t.is(response.status, 'ok', response.error)
  const data = response.data as TypedData[]
  t.is(data.length, 2)
  t.is(data[0].id, 'ent1')
  t.is(data[1].id, 'ent2')
  t.deepEqual(response.paging, expectedPaging)
})

test('should get second page of documents', async (t) => {
  const { collection, collectionName } = t.context
  await insertDocuments(collection, [
    { _id: '12345', id: 'ent1' },
    { _id: '12346', id: 'ent2' },
    { _id: '12347', id: 'ent3' },
    { _id: '12348', id: 'ent4' },
  ])
  const action = {
    type: 'GET',
    payload: {
      type: 'entry',
      pageId: 'ZW50Mnw+',
      pageSize: 2,
    },
    meta: {
      options: {
        collection: collectionName,
        db: 'test',
      },
    },
  }
  const expectedPaging = {
    next: {
      type: 'entry',
      pageId: 'ZW50NHw+',
      pageSize: 2,
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

  t.is(response.status, 'ok', response.error)
  const data = response.data as TypedData[]
  t.is(data.length, 2)
  t.is(data[0].id, 'ent3')
  t.is(data[1].id, 'ent4')
  t.deepEqual(response.paging, expectedPaging)
})

test('should get second page of documents using date index', async (t) => {
  const { collection, collectionName } = t.context
  await insertDocuments(collection, [
    {
      _id: '12345',
      id: 'ent1',
      date: new Date('2021-01-18T10:44:07Z'),
    },
    {
      _id: '12346',
      id: 'ent2',
      date: new Date('2021-01-18T11:05:16Z'),
    },
  ])
  const action = {
    type: 'GET',
    payload: {
      type: 'entry',
      pageId: 'ZW50MXxkYXRlPjIwMjEtMDEtMThUMTA6NDQ6MDcuMDAwWg',
      pageSize: 1,
    },
    meta: {
      options: {
        collection: collectionName,
        db: 'test',
        sort: { date: 1 },
      },
    },
  }
  const expectedPaging = {
    next: {
      type: 'entry',
      pageId: 'ZW50MnxkYXRlPjIwMjEtMDEtMThUMTE6MDU6MTYuMDAwWg',
      pageSize: 1,
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

  t.is(response.status, 'ok', response.error)
  const data = response.data as TypedData[]
  t.is(data.length, 1)
  t.is(data[0].id, 'ent2')
  t.deepEqual(response.paging, expectedPaging)
})

test('should return less than a full page at the end', async (t) => {
  const { collection, collectionName } = t.context
  await insertDocuments(collection, [
    { _id: '12345', id: 'ent1' },
    { _id: '12346', id: 'ent2' },
    { _id: '12347', id: 'ent3' },
  ])
  const action = {
    type: 'GET',
    payload: {
      type: 'entry',
      pageId: 'ZW50Mnw+',
      pageSize: 2,
    },
    meta: {
      options: {
        collection: collectionName,
        db: 'test',
      },
    },
  }
  const expectedPaging = {
    next: undefined,
  }

  const connection = await transporter.connect(
    options,
    authorization,
    null,
    emit
  )
  const response = await transporter.send(action, connection)
  await transporter.disconnect(connection)

  t.is(response.status, 'ok', response.error)
  const data = response.data as TypedData[]
  t.is(data.length, 1)
  t.is(data[0].id, 'ent3')
  t.deepEqual(response.paging, expectedPaging)
})

test('should return empty array when past last page', async (t) => {
  const { collection, collectionName } = t.context
  await insertDocuments(collection, [
    { _id: '12345', id: 'ent1' },
    { _id: '12346', id: 'ent2' },
    { _id: '12347', id: 'ent3' },
    { _id: '12348', id: 'ent4' },
  ])
  const action = {
    type: 'GET',
    payload: {
      type: 'entry',
      query: [{ path: '_id', op: 'gte', value: 'ent4' }],
      pageId: 'ZW50NHw+',
      pageSize: 2,
    },
    meta: {
      options: {
        collection: collectionName,
        db: 'test',
      },
    },
  }
  const expectedPaging = {
    next: undefined,
  }

  const connection = await transporter.connect(
    options,
    authorization,
    null,
    emit
  )
  const response = await transporter.send(action, connection)
  await transporter.disconnect(connection)

  t.is(response.status, 'ok', response.error)
  const data = response.data as TypedData[]
  t.is(data.length, 0)
  t.deepEqual(response.paging, expectedPaging)
})

test('should not throw when pageId does not exist', async (t) => {
  const { collection, collectionName } = t.context
  await insertDocuments(collection, [
    { _id: '12345', id: 'ent1' },
    { _id: '12346', id: 'ent2' },
  ])
  const action = {
    type: 'GET',
    payload: {
      type: 'entry',
      query: [{ path: 'id', op: 'gte', value: 'ent3' }],
      pageSize: 2,
    },
    meta: {
      options: {
        collection: collectionName,
        db: 'test',
      },
    },
  }
  const expectedPaging = {
    next: undefined,
  }

  const connection = await transporter.connect(
    options,
    authorization,
    null,
    emit
  )
  const response = await transporter.send(action, connection)
  await transporter.disconnect(connection)

  t.is(response.status, 'ok', response.error)
  const data = response.data as TypedData[]
  t.is(data.length, 0)
  t.deepEqual(response.paging, expectedPaging)
})

test('should get second page of documents when sorting', async (t) => {
  const { collection, collectionName } = t.context
  await insertDocuments(collection, [
    {
      _id: '12345',
      id: 'ent1',
      attributes: { index: 3 },
    },
    {
      _id: '12346',
      id: 'ent2',
      attributes: { index: 1 },
    },
    {
      _id: '12347',
      id: 'ent3',
      attributes: { index: 2 },
    },
    {
      _id: '12348',
      id: 'ent4',
      attributes: { index: 4 },
    },
  ])
  const action = {
    type: 'GET',
    payload: {
      type: 'entry',
      pageId: 'ZW50M3xhdHRyaWJ1dGVzLmluZGV4PjI',
      pageSize: 2,
    },
    meta: {
      options: {
        collection: collectionName,
        db: 'test',
        sort: { 'attributes.index': 1 },
      },
    },
  }
  const expectedPaging = {
    next: {
      type: 'entry',
      pageId: 'ZW50NHxhdHRyaWJ1dGVzLmluZGV4PjQ',
      pageSize: 2,
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

  t.is(response.status, 'ok', response.error)
  const data = response.data as TypedData[]
  t.is(data.length, 2)
  t.is(data[0].id, 'ent1')
  t.is(data[1].id, 'ent4')
  t.deepEqual(response.paging, expectedPaging)
})

test('should get second page of documents when sorting descending', async (t) => {
  const { collection, collectionName } = t.context
  await insertDocuments(collection, [
    {
      _id: '12345',
      id: 'ent1',
      attributes: { index: 3 },
    },
    {
      _id: '12346',
      id: 'ent2',
      attributes: { index: 1 },
    },
    {
      _id: '12347',
      id: 'ent3',
      attributes: { index: 2 },
    },
    {
      _id: '12348',
      id: 'ent4',
      attributes: { index: 4 },
    },
  ])
  const action = {
    type: 'GET',
    payload: {
      type: 'entry',
      pageId: 'ZW50MXxhdHRyaWJ1dGVzLmluZGV4PDM',
      pageSize: 2,
    },
    meta: {
      options: {
        collection: collectionName,
        db: 'test',
        sort: { 'attributes.index': -1 },
      },
    },
  }
  const expectedPaging = {
    next: {
      type: 'entry',
      pageId: 'ZW50MnxhdHRyaWJ1dGVzLmluZGV4PDE',
      pageSize: 2,
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

  t.is(response.status, 'ok', response.error)
  const data = response.data as TypedData[]
  t.is(data.length, 2)
  t.is(data[0].id, 'ent3')
  t.is(data[1].id, 'ent2')
  t.deepEqual(response.paging, expectedPaging)
})

test('should return page params when sorting by two dimensions', async (t) => {
  const { collection, collectionName } = t.context
  await insertDocuments(collection, [
    {
      _id: '12345',
      id: 'ent1',
      attributes: { timestamp: 1584211391000, index: 3 }, // 3
    },
    {
      _id: '12346',
      id: 'ent2',
      attributes: { timestamp: 1584211391000, index: 1 }, // 2
    },
    {
      _id: '12347',
      id: 'ent3',
      attributes: { timestamp: 1584211390083, index: 2 }, // 4
    },
    {
      _id: '12348',
      id: 'ent4',
      attributes: { timestamp: 1584211393300, index: 4 }, // 1
    },
  ])
  const action = {
    type: 'GET',
    payload: {
      type: 'entry',
      pageId: undefined,
      pageSize: 2,
    },
    meta: {
      options: {
        collection: collectionName,
        db: 'test',
        sort: { 'attributes.timestamp': -1, 'attributes.index': 1 },
      },
    },
  }
  const expectedPaging = {
    next: {
      type: 'entry',
      pageId: 'ZW50MnxhdHRyaWJ1dGVzLnRpbWVzdGFtcDwxNTg0MjExMzkxMDAw',
      pageSize: 2,
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

  t.is(response.status, 'ok', response.error)
  const data = response.data as TypedData[]
  t.is(data.length, 2)
  t.is(data[0].id, 'ent4')
  t.is(data[1].id, 'ent2')
  t.deepEqual(response.paging, expectedPaging)
})

test('should get second page of documents when sorting key is not unique', async (t) => {
  const { collection, collectionName } = t.context
  await insertDocuments(collection, [
    {
      _id: '12345',
      id: 'ent1',
      attributes: { index: 2 },
    },
    {
      _id: '12346',
      id: 'ent2',
      attributes: { index: 1 },
    },
    {
      _id: '12347',
      id: 'ent3',
      attributes: { index: 1 },
    },
    {
      _id: '12348',
      id: 'ent4',
      attributes: { index: 3 },
    },
  ])
  const action = {
    type: 'GET',
    payload: {
      type: 'entry',
      pageId: 'ZW50M3xhdHRyaWJ1dGVzLmluZGV4PjE',
      pageSize: 2,
    },
    meta: {
      options: {
        collection: collectionName,
        db: 'test',
        sort: { 'attributes.index': 1 },
      },
    },
  }
  const expectedPaging = {
    next: {
      type: 'entry',
      pageId: 'ZW50NHxhdHRyaWJ1dGVzLmluZGV4PjM',
      pageSize: 2,
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

  t.is(response.status, 'ok', response.error)
  const data = response.data as TypedData[]
  t.is(data.length, 2)
  t.is(data[0].id, 'ent1')
  t.is(data[1].id, 'ent4')
  t.deepEqual(response.paging, expectedPaging)
})

test('should keep existing queries', async (t) => {
  const { collection, collectionName } = t.context
  await insertDocuments(collection, [
    {
      _id: '12345',
      id: 'ent1',
      attributes: { timestamp: 1584211391000, index: 3 }, // 3
    },
    {
      _id: '12346',
      id: 'ent2',
      attributes: { timestamp: 1584211391000, index: 1 }, // 2
    },
    {
      _id: '12347',
      id: 'ent3',
      attributes: { timestamp: 1584211390083, index: 2 }, // 4
    },
    {
      _id: '12348',
      id: 'ent4',
      attributes: { timestamp: 1584211393300, index: 4 }, // 1
    },
  ])
  const action = {
    type: 'GET',
    payload: {
      type: 'entry',
      query: [{ path: 'attributes.index', op: 'lt', value: 3 }],
      pageId: undefined,
      pageSize: 2,
    },
    meta: {
      options: {
        collection: collectionName,
        db: 'test',
        sort: { 'attributes.timestamp': -1, 'attributes.index': 1 },
      },
    },
  }
  const expectedPaging = {
    next: {
      type: 'entry',
      query: [{ path: 'attributes.index', op: 'lt', value: 3 }],
      pageId: 'ZW50M3xhdHRyaWJ1dGVzLnRpbWVzdGFtcDwxNTg0MjExMzkwMDgz',
      pageSize: 2,
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

  t.is(response.status, 'ok', response.error)
  const data = response.data as TypedData[]
  t.is(data.length, 2)
  t.is(data[0].id, 'ent2')
  t.is(data[1].id, 'ent3')
  t.deepEqual(response.paging, expectedPaging)
})

// Tests -- pageOffset

test('should get one page of documents with params for next page - using pageOffset', async (t) => {
  const { collection, collectionName } = t.context
  await insertDocuments(collection, [
    { _id: '12345', id: 'ent1' },
    { _id: '12346', id: 'ent2' },
    { _id: '12347', id: 'ent2' },
  ])
  const action = {
    type: 'GET',
    payload: {
      type: 'entry',
      pageOffset: 0,
      pageSize: 2,
    },
    meta: {
      options: {
        collection: collectionName,
        db: 'test',
      },
    },
  }
  const expectedPaging = {
    next: {
      type: 'entry',
      pageOffset: 2,
      pageSize: 2,
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

  t.is(response.status, 'ok', response.error)
  const data = response.data as TypedData[]
  t.is(data.length, 2)
  t.is(data[0].id, 'ent1')
  t.is(data[1].id, 'ent2')
  t.deepEqual(response.paging, expectedPaging)
})

test('should get second page of documents - using pageOffset', async (t) => {
  const { collection, collectionName } = t.context
  await insertDocuments(collection, [
    { _id: '12345', id: 'ent1' },
    { _id: '12346', id: 'ent2' },
    { _id: '12347', id: 'ent3' },
    { _id: '12348', id: 'ent4' },
  ])
  const action = {
    type: 'GET',
    payload: {
      type: 'entry',
      pageOffset: 2,
      pageSize: 2,
    },
    meta: {
      options: {
        collection: collectionName,
        db: 'test',
      },
    },
  }
  const expectedPaging = {
    next: {
      type: 'entry',
      pageOffset: 4,
      pageSize: 2,
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

  t.is(response.status, 'ok', response.error)
  const data = response.data as TypedData[]
  t.is(data.length, 2)
  t.is(data[0].id, 'ent3')
  t.is(data[1].id, 'ent4')
  t.deepEqual(response.paging, expectedPaging)
})

test('should get one page of aggregated documents with params for next page - using pageOffset', async (t) => {
  const { collection, collectionName } = t.context
  await insertDocuments(collection, [
    { _id: '12345', id: 'ent1', amount: 52, type: 'fish' },
    { _id: '12346', id: 'ent2', amount: 34, type: 'meat' },
    { _id: '12347', id: 'ent2', amount: 70, type: 'fish' },
    { _id: '12348', id: 'ent3', amount: 4, type: 'veggis' },
  ])
  const action = {
    type: 'GET',
    payload: {
      type: 'entry',
      pageOffset: 0,
      pageSize: 2,
    },
    meta: {
      options: {
        collection: collectionName,
        aggregation: [
          {
            type: 'group',
            groupBy: ['type'],
            values: { amount: 'sum', type: 'first' },
          },
          { type: 'sort', sortBy: { type: 1 } },
        ],
        db: 'test',
      },
    },
  }
  const expectedData = [
    { amount: 122, type: 'fish' },
    { amount: 34, type: 'meat' },
  ]
  const expectedPaging = {
    next: {
      type: 'entry',
      pageOffset: 2,
      pageSize: 2,
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

  t.is(response.status, 'ok', response.error)
  const data = response.data as TypedData[]
  t.deepEqual(data, expectedData)
  t.deepEqual(response.paging, expectedPaging)
})

test('should get second page of aggregated documents with params for next page - using pageOffset', async (t) => {
  const { collection, collectionName } = t.context
  await insertDocuments(collection, [
    { _id: '12345', id: 'ent1', amount: 52, type: 'fish' },
    { _id: '12346', id: 'ent2', amount: 34, type: 'meat' },
    { _id: '12347', id: 'ent2', amount: 70, type: 'fish' },
    { _id: '12348', id: 'ent3', amount: 4, type: 'veggis' },
  ])
  const action = {
    type: 'GET',
    payload: {
      type: 'entry',
      pageOffset: 2,
      pageSize: 2,
    },
    meta: {
      options: {
        collection: collectionName,
        aggregation: [
          {
            type: 'group',
            groupBy: ['type'],
            values: { amount: 'sum', type: 'first' },
          },
          { type: 'sort', sortBy: { type: 1 } },
        ],
        db: 'test',
      },
    },
  }
  const expectedData = [{ amount: 4, type: 'veggis' }]
  const expectedPaging = { next: undefined }

  const connection = await transporter.connect(
    options,
    authorization,
    null,
    emit
  )
  const response = await transporter.send(action, connection)
  await transporter.disconnect(connection)

  t.is(response.status, 'ok', response.error)
  const data = response.data as TypedData[]
  t.deepEqual(data, expectedData)
  t.deepEqual(response.paging, expectedPaging)
})
