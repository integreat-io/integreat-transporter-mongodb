import test from 'ava'
import {
  baseUri,
  openMongoWithCollection,
  closeMongo,
  insertDocuments,
  deleteDocuments
} from './helpers/mongo'

import mongodb from '..'
const { adapter } = mongodb

// Helpers

const sourceOptions = { baseUri }

test.beforeEach(async (t) => {
  t.context = await openMongoWithCollection('test')
})

test.afterEach.always(async (t) => {
  const { client, collection } = t.context
  deleteDocuments(collection, { type: 'entry' })
  closeMongo(client)
})

// Tests

test('should get one page of documents with params for next page', async (t) => {
  const { collection, collectionName } = t.context
  await insertDocuments(collection, [
    { _id: 'entry:ent1', id: 'ent1', type: 'entry' },
    { _id: 'entry:ent2', id: 'ent2', type: 'entry' },
    { _id: 'entry:ent3', id: 'ent2', type: 'entry' }
  ])
  const request = {
    action: 'GET',
    params: {
      type: 'entry',
      pageSize: 2
    },
    endpoint: {
      collection: collectionName,
      db: 'test'
    }
  }
  const expectedPaging = {
    next: {
      type: 'entry',
      query: { _id: { $gte: 'entry:ent2' } },
      pageAfter: 'entry:ent2',
      pageSize: 2
    }
  }

  const connection = await adapter.connect({ sourceOptions })
  const response = await adapter.send(request, connection)
  await adapter.disconnect(connection)

  t.truthy(response)
  t.is(response.status, 'ok')
  const { data } = response
  t.is(data.length, 2)
  t.is(data[0].id, 'ent1')
  t.is(data[1].id, 'ent2')
  t.deepEqual(response.paging, expectedPaging)
})

test('should get second page of documents', async (t) => {
  const { collection, collectionName } = t.context
  await insertDocuments(collection, [
    { _id: 'entry:ent1', id: 'ent1', type: 'entry' },
    { _id: 'entry:ent2', id: 'ent2', type: 'entry' },
    { _id: 'entry:ent3', id: 'ent3', type: 'entry' },
    { _id: 'entry:ent4', id: 'ent4', type: 'entry' }
  ])
  const request = {
    action: 'GET',
    params: {
      type: 'entry',
      query: { _id: { $gte: 'entry:ent2' } },
      pageAfter: 'entry:ent2',
      pageSize: 2
    },
    endpoint: {
      collection: collectionName,
      db: 'test'
    }
  }
  const expectedPaging = {
    next: {
      type: 'entry',
      query: { _id: { $gte: 'entry:ent4' } },
      pageAfter: 'entry:ent4',
      pageSize: 2
    }
  }

  const connection = await adapter.connect({ sourceOptions })
  const response = await adapter.send(request, connection)
  await adapter.disconnect(connection)

  t.truthy(response)
  t.is(response.status, 'ok')
  const { data } = response
  t.is(data.length, 2)
  t.is(data[0].id, 'ent3')
  t.is(data[1].id, 'ent4')
  t.deepEqual(response.paging, expectedPaging)
})

test('should return less than a full page at the end', async (t) => {
  const { collection, collectionName } = t.context
  await insertDocuments(collection, [
    { _id: 'entry:ent1', id: 'ent1', type: 'entry' },
    { _id: 'entry:ent2', id: 'ent2', type: 'entry' },
    { _id: 'entry:ent3', id: 'ent3', type: 'entry' }
  ])
  const request = {
    action: 'GET',
    params: {
      type: 'entry',
      query: { _id: { $gte: 'entry:ent2' } },
      pageAfter: 'entry:ent2',
      pageSize: 2
    },
    endpoint: {
      collection: collectionName,
      db: 'test'
    }
  }
  const expectedPaging = {
    next: {
      type: 'entry',
      query: { _id: { $gte: 'entry:ent3' } },
      pageAfter: 'entry:ent3',
      pageSize: 2
    }
  }

  const connection = await adapter.connect({ sourceOptions })
  const response = await adapter.send(request, connection)
  await adapter.disconnect(connection)

  t.truthy(response)
  t.is(response.status, 'ok')
  const { data } = response
  t.is(data.length, 1)
  t.is(data[0].id, 'ent3')
  t.deepEqual(response.paging, expectedPaging)
})

test('should return empty array when past last page', async (t) => {
  const { collection, collectionName } = t.context
  await insertDocuments(collection, [
    { _id: 'entry:ent1', id: 'ent1', type: 'entry' },
    { _id: 'entry:ent2', id: 'ent2', type: 'entry' },
    { _id: 'entry:ent3', id: 'ent3', type: 'entry' },
    { _id: 'entry:ent4', id: 'ent4', type: 'entry' }
  ])
  const request = {
    action: 'GET',
    params: {
      type: 'entry',
      query: { _id: { $gte: 'entry:ent4' } },
      pageAfter: 'entry:ent4',
      pageSize: 2
    },
    endpoint: {
      collection: collectionName,
      db: 'test'
    }
  }
  const expectedPaging = {
    next: null
  }

  const connection = await adapter.connect({ sourceOptions })
  const response = await adapter.send(request, connection)
  await adapter.disconnect(connection)

  t.truthy(response)
  t.is(response.status, 'ok')
  const { data } = response
  t.is(data.length, 0)
  t.deepEqual(response.paging, expectedPaging)
})

test('should not throw when pageAfter does not exist', async (t) => {
  const { collection, collectionName } = t.context
  await insertDocuments(collection, [
    { _id: 'entry:ent1', id: 'ent1', type: 'entry' },
    { _id: 'entry:ent2', id: 'ent2', type: 'entry' }
  ])
  const request = {
    action: 'GET',
    params: {
      type: 'entry',
      query: { _id: { $gte: 'entry:ent3' } },
      pageAfter: 'entry:ent3',
      pageSize: 2
    },
    endpoint: {
      collection: collectionName,
      db: 'test'
    }
  }
  const expectedPaging = {
    next: null
  }

  const connection = await adapter.connect({ sourceOptions })
  const response = await adapter.send(request, connection)
  await adapter.disconnect(connection)

  t.truthy(response)
  t.is(response.status, 'ok')
  const { data } = response
  t.is(data.length, 0)
  t.deepEqual(response.paging, expectedPaging)
})

test('should get second page of documents when sorting', async (t) => {
  const { collection, collectionName } = t.context
  await insertDocuments(collection, [
    { _id: 'entry:ent1', id: 'ent1', type: 'entry', attributes: { index: 3 } },
    { _id: 'entry:ent2', id: 'ent2', type: 'entry', attributes: { index: 1 } },
    { _id: 'entry:ent3', id: 'ent3', type: 'entry', attributes: { index: 2 } },
    { _id: 'entry:ent4', id: 'ent4', type: 'entry', attributes: { index: 4 } }
  ])
  const request = {
    action: 'GET',
    params: {
      type: 'entry',
      query: { 'attributes.index': { $gte: 2 } },
      pageAfter: 'entry:ent3',
      pageSize: 2
    },
    endpoint: {
      collection: collectionName,
      db: 'test',
      sort: { 'attributes.index': 1 }
    }
  }
  const expectedPaging = {
    next: {
      type: 'entry',
      query: { 'attributes.index': { $gte: 4 } },
      pageAfter: 'entry:ent4',
      pageSize: 2
    }
  }

  const connection = await adapter.connect({ sourceOptions })
  const response = await adapter.send(request, connection)
  await adapter.disconnect(connection)

  t.truthy(response)
  t.is(response.status, 'ok')
  const { data } = response
  t.is(data.length, 2)
  t.is(data[0].id, 'ent1')
  t.is(data[1].id, 'ent4')
  t.deepEqual(response.paging, expectedPaging)
})

test('should get second page of documents when sorting descending', async (t) => {
  const { collection, collectionName } = t.context
  await insertDocuments(collection, [
    { _id: 'entry:ent1', id: 'ent1', type: 'entry', attributes: { index: 3 } },
    { _id: 'entry:ent2', id: 'ent2', type: 'entry', attributes: { index: 1 } },
    { _id: 'entry:ent3', id: 'ent3', type: 'entry', attributes: { index: 2 } },
    { _id: 'entry:ent4', id: 'ent4', type: 'entry', attributes: { index: 4 } }
  ])
  const request = {
    action: 'GET',
    params: {
      type: 'entry',
      query: { 'attributes.index': { $lte: 3 } },
      pageAfter: 'entry:ent1',
      pageSize: 2
    },
    endpoint: {
      collection: collectionName,
      db: 'test',
      sort: { 'attributes.index': -1 }
    }
  }
  const expectedPaging = {
    next: {
      type: 'entry',
      query: { 'attributes.index': { $lte: 1 } },
      pageAfter: 'entry:ent2',
      pageSize: 2
    }
  }

  const connection = await adapter.connect({ sourceOptions })
  const response = await adapter.send(request, connection)
  await adapter.disconnect(connection)

  t.truthy(response)
  t.is(response.status, 'ok')
  const { data } = response
  t.is(data.length, 2)
  t.is(data[0].id, 'ent3')
  t.is(data[1].id, 'ent2')
  t.deepEqual(response.paging, expectedPaging)
})

test('should get second page of documents when sorting key is not unique', async (t) => {
  const { collection, collectionName } = t.context
  await insertDocuments(collection, [
    { _id: 'entry:ent1', id: 'ent1', type: 'entry', attributes: { index: 2 } },
    { _id: 'entry:ent2', id: 'ent2', type: 'entry', attributes: { index: 1 } },
    { _id: 'entry:ent3', id: 'ent3', type: 'entry', attributes: { index: 1 } },
    { _id: 'entry:ent4', id: 'ent4', type: 'entry', attributes: { index: 3 } }
  ])
  const request = {
    action: 'GET',
    params: {
      type: 'entry',
      query: { 'attributes.index': { $gte: 1 } },
      pageAfter: 'entry:ent3',
      pageSize: 2
    },
    endpoint: {
      collection: collectionName,
      db: 'test',
      sort: { 'attributes.index': 1 }
    }
  }
  const expectedPaging = {
    next: {
      type: 'entry',
      query: { 'attributes.index': { $gte: 3 } },
      pageAfter: 'entry:ent4',
      pageSize: 2
    }
  }

  const connection = await adapter.connect({ sourceOptions })
  const response = await adapter.send(request, connection)
  await adapter.disconnect(connection)

  t.truthy(response)
  t.is(response.status, 'ok')
  const { data } = response
  t.is(data.length, 2)
  t.is(data[0].id, 'ent1')
  t.is(data[1].id, 'ent4')
  t.deepEqual(response.paging, expectedPaging)
})
