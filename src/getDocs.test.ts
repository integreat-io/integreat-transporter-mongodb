import test from 'ava'
import sinon = require('sinon')
import { TypedData } from 'integreat'
import { Collection, MongoClient } from 'mongodb'
import defaultExchange from './tests/helpers/defaultExchange'

import getDocs from './getDocs'

// Helpers

const createCollectionMethod = (items: TypedData[]) => {
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

const createClient = (collection: unknown) =>
  (({
    db: () => ({
      collection: () => collection as Collection,
    }),
  } as unknown) as MongoClient)

// Tests

test('should get items', async (t) => {
  const find = createCollectionMethod([
    { id: 'ent1', $type: 'entry' },
    { id: 'ent2', $type: 'entry' },
  ])
  const client = createClient({ find })
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

  const { status, response } = await getDocs(exchange, client)

  t.is(status, 'ok')
  const data = response.data as TypedData[]
  t.is(data.length, 2)
  t.is(data[0].id, 'ent1')
  t.is(data[1].id, 'ent2')
  t.true(find.calledWith(expectedQuery))
})

test('should get one item', async (t) => {
  const find = createCollectionMethod([{ id: 'ent1', $type: 'entry' }])
  const client = createClient({ find })
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

  const { status, response } = await getDocs(exchange, client)

  t.is(status, 'ok')
  const data = response.data as TypedData[]
  t.is(data.length, 1)
  t.is(data[0].id, 'ent1')
  t.true(find.calledWith({ _id: 'entry:ent1' }))
})

test('should get with query', async (t) => {
  const find = createCollectionMethod([])
  const client = createClient({ find })
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
        { path: 'personalia\\.age', op: 'gt', value: 18 },
      ],
    },
  }
  const expectedQuery = {
    '\\$type': 'entry',
    'personalia\\_age': { $gt: 18 },
  }

  await getDocs(exchange, client)

  const arg = find.args[0][0]
  t.deepEqual(arg, expectedQuery)
})

test('should get with aggregation', async (t) => {
  const find = createCollectionMethod([])
  const aggregate = createCollectionMethod([{ id: 'entry1', $type: 'entry' }])
  const client = createClient({ find, aggregate })
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
      aggregation: [
        { type: 'sort', sortBy: { updatedAt: -1 } },
        {
          type: 'group',
          id: ['account', 'id'],
          groupBy: { updatedAt: 'first', status: 'first' },
        },
        {
          type: 'query',
          query: [
            { path: 'type', param: 'type' },
            { path: 'personalia\\.age', op: 'gt', value: 18 },
          ],
        },
      ],
    },
  }
  const expectedPipeline = [
    { $sort: { updatedAt: -1 } },
    {
      $group: {
        _id: { account: '$account', id: '$id' },
        updatedAt: { $first: '$updatedAt' },
        status: { $first: '$status' },
      },
    },
    {
      $match: {
        '\\$type': 'entry',
        'personalia\\_age': { $gt: 18 },
      },
    },
  ]
  const expectedData = [{ _id: 'entry:entry1', id: 'entry1', $type: 'entry' }]

  const ret = await getDocs(exchange, client)

  t.is(find.callCount, 0)
  t.is(aggregate.callCount, 1)
  const arg = aggregate.args[0][0]
  t.deepEqual(arg, expectedPipeline)
  t.is(ret.status, 'ok')
  t.deepEqual(ret.response.data, expectedData)
})

test('should get put query and sort first in aggregation pipeline', async (t) => {
  const find = createCollectionMethod([])
  const aggregate = createCollectionMethod([])
  const client = createClient({ find, aggregate })
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
        { path: 'personalia\\.age', op: 'gt', value: 18 },
      ],
      sort: { updatedAt: -1 },
      aggregation: [
        {
          type: 'group',
          id: ['account', 'id'],
          groupBy: { updatedAt: 'first', status: 'first' },
        },
      ],
    },
  }
  const expectedPipeline = [
    {
      $match: {
        '\\$type': 'entry',
        'personalia\\_age': { $gt: 18 },
      },
    },
    { $sort: { updatedAt: -1 } },
    {
      $group: {
        _id: { account: '$account', id: '$id' },
        updatedAt: { $first: '$updatedAt' },
        status: { $first: '$status' },
      },
    },
  ]

  await getDocs(exchange, client)

  t.is(find.callCount, 0)
  t.is(aggregate.callCount, 1)
  const arg = aggregate.args[0][0]
  t.deepEqual(arg, expectedPipeline)
})

test('should return badrequest when combining aggregation and paging', async (t) => {
  const find = createCollectionMethod([])
  const aggregate = createCollectionMethod([])
  const client = createClient({ find, aggregate })
  const exchange = {
    ...defaultExchange,
    type: 'GET',
    request: {
      type: 'entry',
      pageSize: 100,
      params: { typePlural: 'entries' },
    },
    options: {
      collection: 'documents',
      db: 'database',
      query: [
        { path: 'type', param: 'type' },
        { path: 'personalia\\.age', op: 'gt', value: 18 },
      ],
      sort: { updatedAt: -1 },
      aggregation: [
        {
          type: 'group',
          id: ['account', 'id'],
          groupBy: { updatedAt: 'first', status: 'first' },
        },
      ],
    },
  }

  const ret = await getDocs(exchange, client)

  t.is(ret.status, 'badrequest')
  t.is(typeof ret.response.error, 'string')
})

test('should get one page of items', async (t) => {
  const find = createCollectionMethod([
    { id: 'ent1', $type: 'entry' },
    { id: 'ent2', $type: 'entry' },
    { id: 'ent3', $type: 'entry' },
  ])
  const client = createClient({ find })
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

  const { status, response } = await getDocs(exchange, client)

  t.is(status, 'ok')
  const data = response.data as TypedData[]
  t.is(data.length, 2)
  t.is(data[0].id, 'ent1')
  t.is(data[1].id, 'ent2')
  t.true(find.calledWith(expectedQuery))
})

test('should return params for next page', async (t) => {
  const find = createCollectionMethod([
    { id: 'ent1', $type: 'entry' },
    { id: 'ent2', $type: 'entry' },
  ])
  const client = createClient({ find })
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
      pageId: 'ZW50cnk6ZW50Mnw+', // entry:ent2|>
      pageSize: 2,
    },
  }

  const { response } = await getDocs(exchange, client)

  t.deepEqual(response.paging, expectedPaging)
})

test('should get second page of items', async (t) => {
  const find = createCollectionMethod([
    { id: 'ent2', $type: 'entry' },
    { id: 'ent3', $type: 'entry' },
    { id: 'ent4', $type: 'entry' },
  ])
  const client = createClient({ find })
  const exchange = {
    ...defaultExchange,
    type: 'GET',
    request: {
      type: 'entry',
      pageSize: 2,
      pageAfter: 'entry:ent2',
      params: {
        typePlural: 'entries',
        pageId: 'ZW50cnk6ZW50Mnw+', // entry:ent2|>
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
      pageId: 'ZW50cnk6ZW50NHw+', // entry:ent4|>
      pageSize: 2,
    },
  }
  const expectedQuery = { '\\$type': 'entry', _id: { $gte: 'entry:ent2' } }

  const { status, response } = await getDocs(exchange, client)

  t.deepEqual(find.args[0][0], expectedQuery)
  t.is(status, 'ok')
  const data = response.data as TypedData[]
  t.is(data.length, 2)
  t.is(data[0].id, 'ent3')
  t.is(data[1].id, 'ent4')
  t.deepEqual(response.paging, expectedPaging)
})

test('should get empty result when we have passed the last page', async (t) => {
  const find = createCollectionMethod([{ id: 'ent4', $type: 'entry' }])
  const client = createClient({ find })
  const exchange = {
    ...defaultExchange,
    type: 'GET',
    request: {
      type: 'entry',
      pageSize: 2,
      pageAfter: 'entry:ent4',
      params: {
        typePlural: 'entries',
        query: [{ path: '_id', op: 'gte', value: 'entry:ent4' }],
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

  const { status, response } = await getDocs(exchange, client)

  t.deepEqual(find.args[0][0], expectedQuery)
  t.is(status, 'ok')
  t.is((response.data as TypedData[]).length, 0)
  t.deepEqual(response.paging, expectedPaging)
})

test('should get empty result when the pageAfter doc is not found', async (t) => {
  const find = createCollectionMethod([{ id: 'ent5', $type: 'entry' }])
  const client = createClient({ find })
  const exchange = {
    ...defaultExchange,
    type: 'GET',
    request: {
      type: 'entry',
      pageSize: 2,
      pageAfter: 'entry:ent4',
      params: {
        typePlural: 'entries',
        query: [{ path: '_id', op: 'gte', value: 'entry:ent4' }],
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

  const { status, response } = await getDocs(exchange, client)

  t.deepEqual(find.args[0][0], expectedQuery)
  t.is(status, 'ok')
  t.is((response.data as TypedData[]).length, 0)
  t.deepEqual(response.paging, expectedPaging)
})

test('should get second page of items when there is documents before the pageAfter', async (t) => {
  const find = createCollectionMethod([
    { id: 'ent1', $type: 'entry', index: 1 },
    { id: 'ent2', $type: 'entry', index: 1 },
    { id: 'ent3', $type: 'entry', index: 2 },
    { id: 'ent4', $type: 'entry', index: 3 },
  ])
  const client = createClient({ find })
  const exchange = {
    ...defaultExchange,
    type: 'GET',
    request: {
      type: 'entry',
      pageSize: 2,
      pageId: 'ZW50cnk6ZW50MnxpbmRleD4x', // entry:ent2|index>1
      params: {
        typePlural: 'entries',
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
      pageId: 'ZW50cnk6ZW50NHxpbmRleD4z', // entry:ent4|index>3
      pageSize: 2,
    },
  }
  const expectedQuery = { '\\$type': 'entry' }

  const { status, response } = await getDocs(exchange, client)

  t.deepEqual(find.args[0][0], expectedQuery)
  t.is(status, 'ok')
  const data = response.data as TypedData[]
  t.is(data.length, 2)
  t.is(data[0].id, 'ent3')
  t.is(data[1].id, 'ent4')
  t.deepEqual(response.paging, expectedPaging)
})

test('should return empty array when collection query comes back empty', async (t) => {
  const find = createCollectionMethod([])
  const client = createClient({ find })
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

  const { status, response } = await getDocs(exchange, client)

  t.is(status, 'ok')
  t.is((response.data as TypedData[]).length, 0)
})

test('should return notfound when member query comes back empty', async (t) => {
  const find = createCollectionMethod([])
  const client = createClient({ find })
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

  const { status, response } = await getDocs(exchange, client)

  t.is(status, 'notfound')
  t.is(response.error, "Could not find 'ent1' of type 'entry'")
})

test('should return error when missing option in exchange', async (t) => {
  const find = createCollectionMethod([])
  const client = createClient({ find })
  const exchange = {
    ...defaultExchange,
    type: 'GET',
    request: {
      id: 'ent1',
      type: 'entry',
      params: { typePlural: 'entries' },
    },
  }

  const { status } = await getDocs(exchange, client)

  t.is(status, 'error')
})
