import ava, { TestFn } from 'ava'
import {
  uri,
  openMongoWithCollection,
  closeMongo,
  insertDocuments,
  deleteDocuments,
  MongoElements,
} from './helpers/mongo'
import { TypedData } from 'integreat'

import transporter from '..'

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
  await deleteDocuments(collection, { '\\$type': 'entry' })
  closeMongo(client)
})

// Tests

test('should get one page of documents with params for next page', async (t) => {
  const { collection, collectionName } = t.context
  await insertDocuments(collection, [
    { _id: 'entry:ent1', id: 'ent1', '\\$type': 'entry' },
    { _id: 'entry:ent2', id: 'ent2', '\\$type': 'entry' },
    { _id: 'entry:ent3', id: 'ent2', '\\$type': 'entry' },
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
      pageId: 'ZW50cnk6ZW50Mnw+',
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

  t.is(response.status, 'ok')
  const data = response.data as TypedData[]
  t.is(data.length, 2)
  t.is(data[0].id, 'ent1')
  t.is(data[1].id, 'ent2')
  t.deepEqual(response.paging, expectedPaging)
})

test('should get second page of documents', async (t) => {
  const { collection, collectionName } = t.context
  await insertDocuments(collection, [
    { _id: 'entry:ent1', id: 'ent1', '\\$type': 'entry' },
    { _id: 'entry:ent2', id: 'ent2', '\\$type': 'entry' },
    { _id: 'entry:ent3', id: 'ent3', '\\$type': 'entry' },
    { _id: 'entry:ent4', id: 'ent4', '\\$type': 'entry' },
  ])
  const action = {
    type: 'GET',
    payload: {
      type: 'entry',
      pageId: 'ZW50cnk6ZW50Mnw+',
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
      pageId: 'ZW50cnk6ZW50NHw+',
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

  t.is(response.status, 'ok')
  const data = response.data as TypedData[]
  t.is(data.length, 2)
  t.is(data[0].id, 'ent3')
  t.is(data[0].$type, 'entry')
  t.is(data[1].id, 'ent4')
  t.deepEqual(response.paging, expectedPaging)
})

test('should get second page of documents using date index', async (t) => {
  const { collection, collectionName } = t.context
  await insertDocuments(collection, [
    {
      _id: 'entry:ent1',
      id: 'ent1',
      '\\$type': 'entry',
      date: new Date('2021-01-18T10:44:07Z'),
    },
    {
      _id: 'entry:ent2',
      id: 'ent2',
      '\\$type': 'entry',
      date: new Date('2021-01-18T11:05:16Z'),
    },
  ])
  const action = {
    type: 'GET',
    payload: {
      type: 'entry',
      pageId: 'ZW50cnk6ZW50MXxkYXRlPjIwMjEtMDEtMThUMTA6NDQ6MDcuMDAwWg',
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
      pageId: 'ZW50cnk6ZW50MnxkYXRlPjIwMjEtMDEtMThUMTE6MDU6MTYuMDAwWg',
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

  t.is(response.status, 'ok')
  const data = response.data as TypedData[]
  t.is(data.length, 1)
  t.is(data[0].id, 'ent2')
  t.is(data[0].$type, 'entry')
  t.deepEqual(response.paging, expectedPaging)
})

test('should return less than a full page at the end', async (t) => {
  const { collection, collectionName } = t.context
  await insertDocuments(collection, [
    { _id: 'entry:ent1', id: 'ent1', '\\$type': 'entry' },
    { _id: 'entry:ent2', id: 'ent2', '\\$type': 'entry' },
    { _id: 'entry:ent3', id: 'ent3', '\\$type': 'entry' },
  ])
  const action = {
    type: 'GET',
    payload: {
      type: 'entry',
      pageId: 'ZW50cnk6ZW50Mnw+',
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

  t.is(response.status, 'ok')
  const data = response.data as TypedData[]
  t.is(data.length, 1)
  t.is(data[0].id, 'ent3')
  t.deepEqual(response.paging, expectedPaging)
})

test('should return empty array when past last page', async (t) => {
  const { collection, collectionName } = t.context
  await insertDocuments(collection, [
    { _id: 'entry:ent1', id: 'ent1', '\\$type': 'entry' },
    { _id: 'entry:ent2', id: 'ent2', '\\$type': 'entry' },
    { _id: 'entry:ent3', id: 'ent3', '\\$type': 'entry' },
    { _id: 'entry:ent4', id: 'ent4', '\\$type': 'entry' },
  ])
  const action = {
    type: 'GET',
    payload: {
      type: 'entry',
      query: [{ path: '_id', op: 'gte', value: 'entry:ent4' }],
      pageId: 'ZW50cnk6ZW50NHw+',
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

  t.is(response.status, 'ok')
  const data = response.data as TypedData[]
  t.is(data.length, 0)
  t.deepEqual(response.paging, expectedPaging)
})

test('should not throw when pageId does not exist', async (t) => {
  const { collection, collectionName } = t.context
  await insertDocuments(collection, [
    { _id: 'entry:ent1', id: 'ent1', '\\$type': 'entry' },
    { _id: 'entry:ent2', id: 'ent2', '\\$type': 'entry' },
  ])
  const action = {
    type: 'GET',
    payload: {
      type: 'entry',
      query: [{ path: '_id', op: 'gte', value: 'entry:ent3' }],
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

  t.is(response.status, 'ok')
  const data = response.data as TypedData[]
  t.is(data.length, 0)
  t.deepEqual(response.paging, expectedPaging)
})

test('should get second page of documents when sorting', async (t) => {
  const { collection, collectionName } = t.context
  await insertDocuments(collection, [
    {
      _id: 'entry:ent1',
      id: 'ent1',
      '\\$type': 'entry',
      attributes: { index: 3 },
    },
    {
      _id: 'entry:ent2',
      id: 'ent2',
      '\\$type': 'entry',
      attributes: { index: 1 },
    },
    {
      _id: 'entry:ent3',
      id: 'ent3',
      '\\$type': 'entry',
      attributes: { index: 2 },
    },
    {
      _id: 'entry:ent4',
      id: 'ent4',
      '\\$type': 'entry',
      attributes: { index: 4 },
    },
  ])
  const action = {
    type: 'GET',
    payload: {
      type: 'entry',
      pageId: 'ZW50cnk6ZW50M3xhdHRyaWJ1dGVzLmluZGV4PjI',
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
      pageId: 'ZW50cnk6ZW50NHxhdHRyaWJ1dGVzLmluZGV4PjQ',
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

  t.is(response.status, 'ok')
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
      _id: 'entry:ent1',
      id: 'ent1',
      '\\$type': 'entry',
      attributes: { index: 3 },
    },
    {
      _id: 'entry:ent2',
      id: 'ent2',
      '\\$type': 'entry',
      attributes: { index: 1 },
    },
    {
      _id: 'entry:ent3',
      id: 'ent3',
      '\\$type': 'entry',
      attributes: { index: 2 },
    },
    {
      _id: 'entry:ent4',
      id: 'ent4',
      '\\$type': 'entry',
      attributes: { index: 4 },
    },
  ])
  const action = {
    type: 'GET',
    payload: {
      type: 'entry',
      pageId: 'ZW50cnk6ZW50MXxhdHRyaWJ1dGVzLmluZGV4PDM',
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
      pageId: 'ZW50cnk6ZW50MnxhdHRyaWJ1dGVzLmluZGV4PDE',
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

  t.is(response.status, 'ok')
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
      _id: 'entry:ent1',
      id: 'ent1',
      '\\$type': 'entry',
      attributes: { timestamp: 1584211391000, index: 3 }, // 3
    },
    {
      _id: 'entry:ent2',
      id: 'ent2',
      '\\$type': 'entry',
      attributes: { timestamp: 1584211391000, index: 1 }, // 2
    },
    {
      _id: 'entry:ent3',
      id: 'ent3',
      '\\$type': 'entry',
      attributes: { timestamp: 1584211390083, index: 2 }, // 4
    },
    {
      _id: 'entry:ent4',
      id: 'ent4',
      '\\$type': 'entry',
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
      pageId: 'ZW50cnk6ZW50MnxhdHRyaWJ1dGVzLnRpbWVzdGFtcDwxNTg0MjExMzkxMDAw',
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

  t.is(response.status, 'ok')
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
      _id: 'entry:ent1',
      id: 'ent1',
      '\\$type': 'entry',
      attributes: { index: 2 },
    },
    {
      _id: 'entry:ent2',
      id: 'ent2',
      '\\$type': 'entry',
      attributes: { index: 1 },
    },
    {
      _id: 'entry:ent3',
      id: 'ent3',
      '\\$type': 'entry',
      attributes: { index: 1 },
    },
    {
      _id: 'entry:ent4',
      id: 'ent4',
      '\\$type': 'entry',
      attributes: { index: 3 },
    },
  ])
  const action = {
    type: 'GET',
    payload: {
      type: 'entry',
      pageId: 'ZW50cnk6ZW50M3xhdHRyaWJ1dGVzLmluZGV4PjE',
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
      pageId: 'ZW50cnk6ZW50NHxhdHRyaWJ1dGVzLmluZGV4PjM',
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

  t.is(response.status, 'ok')
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
      _id: 'entry:ent1',
      id: 'ent1',
      '\\$type': 'entry',
      attributes: { timestamp: 1584211391000, index: 3 }, // 3
    },
    {
      _id: 'entry:ent2',
      id: 'ent2',
      '\\$type': 'entry',
      attributes: { timestamp: 1584211391000, index: 1 }, // 2
    },
    {
      _id: 'entry:ent3',
      id: 'ent3',
      '\\$type': 'entry',
      attributes: { timestamp: 1584211390083, index: 2 }, // 4
    },
    {
      _id: 'entry:ent4',
      id: 'ent4',
      '\\$type': 'entry',
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
      pageId: 'ZW50cnk6ZW50M3xhdHRyaWJ1dGVzLnRpbWVzdGFtcDwxNTg0MjExMzkwMDgz',
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

  t.is(response.status, 'ok')
  const data = response.data as TypedData[]
  t.is(data.length, 2)
  t.is(data[0].id, 'ent2')
  t.is(data[1].id, 'ent3')
  t.deepEqual(response.paging, expectedPaging)
})
