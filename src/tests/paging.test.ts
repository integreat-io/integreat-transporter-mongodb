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

test('should get one page of documents with params for next page', async (t) => {
  const { collection, collectionName } = t.context
  await insertDocuments(collection, [
    { _id: 'entry:ent1', id: 'ent1', '\\$type': 'entry' },
    { _id: 'entry:ent2', id: 'ent2', '\\$type': 'entry' },
    { _id: 'entry:ent3', id: 'ent2', '\\$type': 'entry' },
  ])
  const exchange = {
    ...defaultExchange,
    type: 'GET',
    request: {
      type: 'entry',
      pageSize: 2,
    },
    options: {
      collection: collectionName,
      db: 'test',
    },
  }
  const expectedPaging = {
    next: {
      type: 'entry',
      query: { _id: { $gte: 'entry:ent2' } },
      pageAfter: 'entry:ent2',
      pageSize: 2,
    },
  }

  const connection = await transporter.connect(options, authorization, null)
  const { status, response } = await transporter.send(exchange, connection)
  await transporter.disconnect(connection)

  t.is(status, 'ok')
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
  const exchange = {
    ...defaultExchange,
    type: 'GET',
    request: {
      type: 'entry',
      params: { query: { _id: { $gte: 'entry:ent2' } } },
      pageAfter: 'entry:ent2',
      pageSize: 2,
    },
    options: {
      collection: collectionName,
      db: 'test',
    },
  }
  const expectedPaging = {
    next: {
      type: 'entry',
      query: { _id: { $gte: 'entry:ent4' } },
      pageAfter: 'entry:ent4',
      pageSize: 2,
    },
  }

  const connection = await transporter.connect(options, authorization, null)
  const { status, response } = await transporter.send(exchange, connection)
  await transporter.disconnect(connection)

  t.is(status, 'ok')
  const data = response.data as TypedData[]
  t.is(data.length, 2)
  t.is(data[0].id, 'ent3')
  t.is(data[0].$type, 'entry')
  t.is(data[1].id, 'ent4')
  t.deepEqual(response.paging, expectedPaging)
})

test('should return less than a full page at the end', async (t) => {
  const { collection, collectionName } = t.context
  await insertDocuments(collection, [
    { _id: 'entry:ent1', id: 'ent1', '\\$type': 'entry' },
    { _id: 'entry:ent2', id: 'ent2', '\\$type': 'entry' },
    { _id: 'entry:ent3', id: 'ent3', '\\$type': 'entry' },
  ])
  const exchange = {
    ...defaultExchange,
    type: 'GET',
    request: {
      type: 'entry',
      params: { query: { _id: { $gte: 'entry:ent2' } } },
      pageAfter: 'entry:ent2',
      pageSize: 2,
    },
    options: {
      collection: collectionName,
      db: 'test',
    },
  }
  const expectedPaging = {
    next: {
      type: 'entry',
      query: { _id: { $gte: 'entry:ent3' } },
      pageAfter: 'entry:ent3',
      pageSize: 2,
    },
  }

  const connection = await transporter.connect(options, authorization, null)
  const { status, response } = await transporter.send(exchange, connection)
  await transporter.disconnect(connection)

  t.is(status, 'ok')
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
  const exchange = {
    ...defaultExchange,
    type: 'GET',
    request: {
      type: 'entry',
      params: { query: { _id: { $gte: 'entry:ent4' } } },
      pageAfter: 'entry:ent4',
      pageSize: 2,
    },
    options: {
      collection: collectionName,
      db: 'test',
    },
  }
  const expectedPaging = {
    next: undefined,
  }

  const connection = await transporter.connect(options, authorization, null)
  const { status, response } = await transporter.send(exchange, connection)
  await transporter.disconnect(connection)

  t.is(status, 'ok')
  const data = response.data as TypedData[]
  t.is(data.length, 0)
  t.deepEqual(response.paging, expectedPaging)
})

test('should not throw when pageAfter does not exist', async (t) => {
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
      params: { query: { _id: { $gte: 'entry:ent3' } } },
      pageAfter: 'entry:ent3',
      pageSize: 2,
    },
    options: {
      collection: collectionName,
      db: 'test',
    },
  }
  const expectedPaging = {
    next: undefined,
  }

  const connection = await transporter.connect(options, authorization, null)
  const { status, response } = await transporter.send(exchange, connection)
  await transporter.disconnect(connection)

  t.is(status, 'ok')
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
  const exchange = {
    ...defaultExchange,
    type: 'GET',
    request: {
      type: 'entry',
      params: { query: { 'attributes.index': { $gte: 2 } } },
      pageAfter: 'entry:ent3',
      pageSize: 2,
    },
    options: {
      collection: collectionName,
      db: 'test',
      sort: { 'attributes.index': 1 },
    },
  }
  const expectedPaging = {
    next: {
      type: 'entry',
      query: { 'attributes.index': { $gte: 4 } },
      pageAfter: 'entry:ent4',
      pageSize: 2,
    },
  }

  const connection = await transporter.connect(options, authorization, null)
  const { status, response } = await transporter.send(exchange, connection)
  await transporter.disconnect(connection)

  t.is(status, 'ok')
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
  const exchange = {
    ...defaultExchange,
    type: 'GET',
    request: {
      type: 'entry',
      params: { query: { 'attributes.index': { $lte: 3 } } },
      pageAfter: 'entry:ent1',
      pageSize: 2,
    },
    options: {
      collection: collectionName,
      db: 'test',
      sort: { 'attributes.index': -1 },
    },
  }
  const expectedPaging = {
    next: {
      type: 'entry',
      query: { 'attributes.index': { $lte: 1 } },
      pageAfter: 'entry:ent2',
      pageSize: 2,
    },
  }

  const connection = await transporter.connect(options, authorization, null)
  const { status, response } = await transporter.send(exchange, connection)
  await transporter.disconnect(connection)

  t.is(status, 'ok')
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
  const exchange = {
    ...defaultExchange,
    type: 'GET',
    request: {
      type: 'entry',
      params: {},
      pageAfter: undefined,
      pageSize: 2,
    },
    options: {
      collection: collectionName,
      db: 'test',
      sort: { 'attributes.timestamp': -1, 'attributes.index': 1 },
    },
  }
  const expectedPaging = {
    next: {
      type: 'entry',
      query: {
        'attributes.timestamp': { $lte: 1584211391000 },
        'attributes.index': { $gte: 1 },
      },
      pageAfter: 'entry:ent2',
      pageSize: 2,
    },
  }

  const connection = await transporter.connect(options, authorization, null)
  const { status, response } = await transporter.send(exchange, connection)
  await transporter.disconnect(connection)

  t.is(status, 'ok')
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
  const exchange = {
    ...defaultExchange,
    type: 'GET',
    request: {
      type: 'entry',
      paras: { query: { 'attributes.index': { $gte: 1 } } },
      pageAfter: 'entry:ent3',
      pageSize: 2,
    },
    options: {
      collection: collectionName,
      db: 'test',
      sort: { 'attributes.index': 1 },
    },
  }
  const expectedPaging = {
    next: {
      type: 'entry',
      query: { 'attributes.index': { $gte: 3 } },
      pageAfter: 'entry:ent4',
      pageSize: 2,
    },
  }

  const connection = await transporter.connect(options, authorization, null)
  const { status, response } = await transporter.send(exchange, connection)
  await transporter.disconnect(connection)

  t.is(status, 'ok')
  const data = response.data as TypedData[]
  t.is(data.length, 2)
  t.is(data[0].id, 'ent1')
  t.is(data[1].id, 'ent4')
  t.deepEqual(response.paging, expectedPaging)
})

test('should combine paging query with existing queries', async (t) => {
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
  const exchange = {
    ...defaultExchange,
    type: 'GET',
    request: {
      type: 'entry',
      params: {
        query: {
          'attributes.index': { $lt: 3 },
        },
      },
      pageAfter: undefined,
      pageSize: 2,
    },
    options: {
      collection: collectionName,
      db: 'test',
      sort: { 'attributes.timestamp': -1, 'attributes.index': 1 },
    },
  }
  const expectedPaging = {
    next: {
      type: 'entry',
      query: {
        'attributes.timestamp': { $lte: 1584211390083 },
        'attributes.index': { $gte: 2, $lt: 3 },
      },
      pageAfter: 'entry:ent3',
      pageSize: 2,
    },
  }

  const connection = await transporter.connect(options, authorization, null)
  const { status, response } = await transporter.send(exchange, connection)
  await transporter.disconnect(connection)

  t.is(status, 'ok')
  const data = response.data as TypedData[]
  t.is(data.length, 2)
  t.is(data[0].id, 'ent2')
  t.is(data[1].id, 'ent3')
  t.deepEqual(response.paging, expectedPaging)
})
