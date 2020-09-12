import test from 'ava'
import sinon = require('sinon')
import { TypedData } from 'integreat'
import { Collection } from 'mongodb'
import defaultExchange from './tests/helpers/defaultExchange'

import getDocs from './getDocs'

// Helpers

const createFind = (items: TypedData[]) => {
  const docs = items.map(({ $type, ...item }) => ({
    ...item,
    _id: `${$type}:${item.id}`,
    '\\$type': $type,
  }))
  const it = docs[Symbol.iterator]()

  const cursor = {
    // toArray returns all docs
    toArray: async () => docs,
    // Mimick limit method
    limit: (size: number) => ({ toArray: async () => docs.slice(0, size) }),
    // Mimick next()
    next: async () => it.next().value,
    sort: () => cursor,
  }

  return sinon.stub().resolves(cursor)
}

// Tests

test('should get items', async (t) => {
  const find = createFind([
    { id: 'ent1', $type: 'entry' },
    { id: 'ent2', $type: 'entry' },
  ])
  const getCollection = () => (({ find } as unknown) as Collection)
  const exchange = {
    ...defaultExchange,
    type: 'GET',
    request: {
      type: 'entry',
      params: { typePlural: 'entries' },
    },
    options: {
      collection: 'documents',
      db: 'database',
    },
  }
  const expectedQuery = { '\\$type': 'entry' }

  const { status, response } = await getDocs(getCollection, exchange)

  t.is(status, 'ok')
  const data = response.data as TypedData[]
  t.is(data.length, 2)
  t.is(data[0].id, 'ent1')
  t.is(data[1].id, 'ent2')
  t.true(find.calledWith(expectedQuery))
})

test('should get one item', async (t) => {
  const find = createFind([{ id: 'ent1', $type: 'entry' }])
  const getCollection = () => (({ find } as unknown) as Collection)
  const exchange = {
    ...defaultExchange,
    type: 'GET',
    request: {
      id: 'ent1',
      type: 'entry',
      params: { typePlural: 'entries' },
    },
    options: {
      collection: 'documents',
      db: 'database',
    },
  }

  const { status, response } = await getDocs(getCollection, exchange)

  t.is(status, 'ok')
  const data = response.data as TypedData[]
  t.is(data.length, 1)
  t.is(data[0].id, 'ent1')
  t.true(find.calledWith({ _id: 'entry:ent1' }))
})

test('should get with query', async (t) => {
  const find = createFind([])
  const getCollection = () => (({ find } as unknown) as Collection)
  const exchange = {
    ...defaultExchange,
    type: 'GET',
    request: {
      type: 'entry',
      params: { typePlural: 'entries' },
    },
    options: {
      collection: 'documents',
      db: 'database',
      query: [
        { path: 'type', param: 'type' },
        { path: 'personalia\\.age.$gt', value: 18 },
      ],
    },
  }
  const expectedQuery = {
    '\\$type': 'entry',
    'personalia\\_age': { $gt: 18 },
  }

  await getDocs(getCollection, exchange)

  const arg = find.args[0][0]
  t.deepEqual(arg, expectedQuery)
})

test('should get one page of items', async (t) => {
  const find = createFind([
    { id: 'ent1', $type: 'entry' },
    { id: 'ent2', $type: 'entry' },
    { id: 'ent3', $type: 'entry' },
  ])
  const getCollection = () => (({ find } as unknown) as Collection)
  const exchange = {
    ...defaultExchange,
    type: 'GET',
    request: {
      type: 'entry',
      pageSize: 2,
      params: { typePlural: 'entries' },
    },
    options: {
      collection: 'documents',
      db: 'database',
    },
  }
  const expectedQuery = { '\\$type': 'entry' }

  const { status, response } = await getDocs(getCollection, exchange)

  t.is(status, 'ok')
  const data = response.data as TypedData[]
  t.is(data.length, 2)
  t.is(data[0].id, 'ent1')
  t.is(data[1].id, 'ent2')
  t.true(find.calledWith(expectedQuery))
})

test('should return params for next page', async (t) => {
  const find = createFind([
    { id: 'ent1', $type: 'entry' },
    { id: 'ent2', $type: 'entry' },
  ])
  const getCollection = () => (({ find } as unknown) as Collection)
  const exchange = {
    ...defaultExchange,
    type: 'GET',
    request: {
      type: 'entry',
      pageSize: 2,
      params: { typePlural: 'entries' },
    },
    options: {
      collection: 'documents',
      db: 'database',
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

  const { response } = await getDocs(getCollection, exchange)

  t.deepEqual(response.paging, expectedPaging)
})

test('should get second page of items', async (t) => {
  const find = createFind([
    { id: 'ent2', $type: 'entry' },
    { id: 'ent3', $type: 'entry' },
    { id: 'ent4', $type: 'entry' },
  ])
  const getCollection = () => (({ find } as unknown) as Collection)
  const exchange = {
    ...defaultExchange,
    type: 'GET',
    request: {
      type: 'entry',
      pageSize: 2,
      pageAfter: 'entry:ent2',
      params: {
        typePlural: 'entries',
        query: { _id: { $gte: 'entry:ent2' } },
      },
    },
    options: {
      collection: 'documents',
      db: 'database',
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
  const expectedQuery = { '\\$type': 'entry', _id: { $gte: 'entry:ent2' } }

  const { status, response } = await getDocs(getCollection, exchange)

  t.deepEqual(find.args[0][0], expectedQuery)
  t.is(status, 'ok')
  const data = response.data as TypedData[]
  t.is(data.length, 2)
  t.is(data[0].id, 'ent3')
  t.is(data[1].id, 'ent4')
  t.deepEqual(response.paging, expectedPaging)
})

test('should get empty result when we have passed the last page', async (t) => {
  const find = createFind([{ id: 'ent4', $type: 'entry' }])
  const getCollection = () => (({ find } as unknown) as Collection)
  const exchange = {
    ...defaultExchange,
    type: 'GET',
    request: {
      type: 'entry',
      pageSize: 2,
      pageAfter: 'entry:ent4',
      params: {
        typePlural: 'entries',
        query: { _id: { $gte: 'entry:ent4' } },
      },
    },
    options: {
      collection: 'documents',
      db: 'database',
    },
  }
  const expectedPaging = {
    next: undefined,
  }
  const expectedQuery = { '\\$type': 'entry', _id: { $gte: 'entry:ent4' } }

  const { status, response } = await getDocs(getCollection, exchange)

  t.deepEqual(find.args[0][0], expectedQuery)
  t.is(status, 'ok')
  t.is((response.data as TypedData[]).length, 0)
  t.deepEqual(response.paging, expectedPaging)
})

test('should get empty result when the pageAfter doc is not found', async (t) => {
  const find = createFind([{ id: 'ent5', $type: 'entry' }])
  const getCollection = () => (({ find } as unknown) as Collection)
  const exchange = {
    ...defaultExchange,
    type: 'GET',
    request: {
      type: 'entry',
      pageSize: 2,
      pageAfter: 'entry:ent4',
      params: {
        typePlural: 'entries',
        query: { _id: { $gte: 'entry:ent4' } },
      },
    },
    options: {
      collection: 'documents',
      db: 'database',
    },
  }
  const expectedPaging = {
    next: undefined,
  }
  const expectedQuery = { '\\$type': 'entry', _id: { $gte: 'entry:ent4' } }

  const { status, response } = await getDocs(getCollection, exchange)

  t.deepEqual(find.args[0][0], expectedQuery)
  t.is(status, 'ok')
  t.is((response.data as TypedData[]).length, 0)
  t.deepEqual(response.paging, expectedPaging)
})

test('should get second page of items when there is documents before the pageAfter', async (t) => {
  const find = createFind([
    { id: 'ent1', $type: 'entry', index: 1 },
    { id: 'ent2', $type: 'entry', index: 1 },
    { id: 'ent3', $type: 'entry', index: 2 },
    { id: 'ent4', $type: 'entry', index: 3 },
  ])
  const getCollection = () => (({ find } as unknown) as Collection)
  const exchange = {
    ...defaultExchange,
    type: 'GET',
    request: {
      type: 'entry',
      pageSize: 2,
      pageAfter: 'entry:ent2',
      params: {
        typePlural: 'entries',
        query: { index: { $gte: 1 } },
      },
    },
    options: {
      collection: 'documents',
      db: 'database',
      sort: { index: 1 },
    },
  }
  const expectedPaging = {
    next: {
      type: 'entry',
      query: { index: { $gte: 3 } },
      pageAfter: 'entry:ent4',
      pageSize: 2,
    },
  }
  const expectedQuery = { '\\$type': 'entry', index: { $gte: 1 } }

  const { status, response } = await getDocs(getCollection, exchange)

  t.deepEqual(find.args[0][0], expectedQuery)
  t.is(status, 'ok')
  const data = response.data as TypedData[]
  t.is(data.length, 2)
  t.is(data[0].id, 'ent3')
  t.is(data[1].id, 'ent4')
  t.deepEqual(response.paging, expectedPaging)
})

test('should return empty array when collection query comes back empty', async (t) => {
  const find = createFind([])
  const getCollection = () => (({ find } as unknown) as Collection)
  const exchange = {
    ...defaultExchange,
    type: 'GET',
    request: {
      type: 'entry',
      params: { typePlural: 'entries' },
    },
    options: {
      collection: 'documents',
      db: 'database',
    },
  }

  const { status, response } = await getDocs(getCollection, exchange)

  t.is(status, 'ok')
  t.is((response.data as TypedData[]).length, 0)
})

test('should return notfound when member query comes back empty', async (t) => {
  const find = createFind([])
  const getCollection = () => (({ find } as unknown) as Collection)
  const exchange = {
    ...defaultExchange,
    type: 'GET',
    request: {
      id: 'ent1',
      type: 'entry',
      params: { typePlural: 'entries' },
    },
    options: {
      collection: 'documents',
      db: 'database',
    },
  }

  const { status, response } = await getDocs(getCollection, exchange)

  t.is(status, 'notfound')
  t.is(response.error, "Could not find 'ent1' of type 'entry'")
})
