import test from 'ava'
import sinon from 'sinon'
import { TypedData } from 'integreat'
import { Collection, MongoClient } from 'mongodb'

import getDocs from './getDocs.js'

// Helpers

const createCollectionMethod = (items: Record<string, unknown>[]) => {
  let offset = 0
  const it = items[Symbol.iterator]()

  const cursor = {
    // toArray returns all docs
    toArray: async () => items.slice(offset),
    // Mimick skip method
    skip: (value: number) => {
      offset += value
      for (let i = 0; i < value; i++) {
        it.next().value
      }
      return cursor
    },
    // Mimick next()
    next: async () => it.next().value,
    sort: () => cursor,
    allowDiskUse: () => cursor, // Only on FindCursor
  }

  return sinon.stub().returns(cursor)
}

const createClient = (collection: unknown) =>
  ({
    db: () => ({
      collection: () => collection as Collection,
    }),
  } as unknown as MongoClient)

// Tests

test('should get items', async (t) => {
  const find = createCollectionMethod([
    { id: 'ent1', $type: 'entry' },
    { id: 'ent2', $type: 'entry' },
  ])
  const client = createClient({ find })
  const action = {
    type: 'GET',
    payload: {
      type: 'entry',
      typePlural: 'entries',
    },
    meta: {
      options: {
        collection: 'documents',
        db: 'database',
      },
    },
  }
  const expectedQuery = {}

  const response = await getDocs(action, client)

  t.is(response?.status, 'ok')
  const data = response?.data as TypedData[]
  t.is(data.length, 2)
  t.is(data[0].id, 'ent1')
  t.is(data[1].id, 'ent2')
  t.is(response?.params?.totalCount, 2)
  t.true(find.calledWith(expectedQuery))
})

test('should get one item', async (t) => {
  const find = createCollectionMethod([{ id: 'ent1', $type: 'entry' }])
  const client = createClient({ find })
  const action = {
    type: 'GET',
    payload: {
      id: 'ent1',
      type: 'entry',
      typePlural: 'entries',
    },
    meta: {
      options: {
        collection: 'documents',
        db: 'database',
      },
    },
  }

  const response = await getDocs(action, client)

  t.is(response?.status, 'ok')
  const data = response?.data as TypedData[]
  t.is(data.length, 1)
  t.is(data[0].id, 'ent1')
  t.true(find.calledWith({ id: 'ent1' }))
})

test('should get with query', async (t) => {
  const find = createCollectionMethod([])
  const client = createClient({ find })
  const action = {
    type: 'GET',
    payload: {
      type: 'entry',
      typePlural: 'entries',
    },
    meta: {
      options: {
        collection: 'documents',
        db: 'database',
        query: [
          { path: 'type', param: 'type' },
          { path: 'personalia\\.age', op: 'gt', value: 18 },
        ],
      },
    },
  }
  const expectedQuery = {
    type: 'entry',
    'personalia\\_age': { $gt: 18 },
  }

  await getDocs(action, client)

  const arg = find.args[0][0]
  t.deepEqual(arg, expectedQuery)
})

test('should get with aggregation', async (t) => {
  const find = createCollectionMethod([])
  const aggregate = createCollectionMethod([
    {
      _id: { 'values\\_account': '1501', id: 'ent1' },
      updatedAt: '2021-01-18T00:00:00Z',
      'values.status': 'inactive',
    },
  ])
  const client = createClient({ find, aggregate })
  const action = {
    type: 'GET',
    payload: {
      type: 'entry',
      typePlural: 'entries',
    },
    meta: {
      options: {
        collection: 'documents',
        db: 'database',
        aggregation: [
          { type: 'sort', sortBy: { updatedAt: -1 } },
          {
            type: 'group',
            groupBy: ['values.account', 'id'],
            values: { updatedAt: 'first', 'values.status': 'first' },
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
    },
  }
  const expectedPipeline = [
    { $sort: { updatedAt: -1 } },
    {
      $group: {
        _id: { 'values\\\\_account': '$values.account', id: '$id' },
        updatedAt: { $first: '$updatedAt' },
        'values\\\\_status': { $first: '$values.status' },
      },
    },
    {
      $match: {
        type: 'entry',
        'personalia\\_age': { $gt: 18 },
      },
    },
    { $sort: { _id: 1 } },
    { $setWindowFields: { output: { __totalCount: { $count: {} } } } }, // Adds total count to every document
  ]
  const expectedData = [
    {
      'values.account': '1501',
      id: 'ent1',
      updatedAt: '2021-01-18T00:00:00Z',
      'values.status': 'inactive',
    },
  ]

  const ret = await getDocs(action, client)

  t.is(find.callCount, 0)
  t.is(aggregate.callCount, 1)
  const arg = aggregate.args[0][0]
  t.deepEqual(arg, expectedPipeline)
  t.is(ret.status, 'ok')
  t.deepEqual(ret.data, expectedData)
  t.is(ret.params?.totalCount, 1)
})

test('should get put query and sort first in aggregation pipeline', async (t) => {
  const find = createCollectionMethod([])
  const aggregate = createCollectionMethod([])
  const client = createClient({ find, aggregate })
  const action = {
    type: 'GET',
    payload: {
      type: 'entry',
      typePlural: 'entries',
    },
    meta: {
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
            groupBy: ['account', 'id'],
            values: { updatedAt: 'first', status: 'first' },
          },
        ],
      },
    },
  }
  const expectedPipeline = [
    {
      $match: {
        type: 'entry',
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
    { $sort: { _id: 1 } },
    { $setWindowFields: { output: { __totalCount: { $count: {} } } } }, // Adds total count to every document
  ]

  await getDocs(action, client)

  t.is(find.callCount, 0)
  t.is(aggregate.callCount, 1)
  const arg = aggregate.args[0][0]
  t.deepEqual(arg, expectedPipeline)
})

test('should return one page of the aggregated result', async (t) => {
  const find = createCollectionMethod([])
  const aggregate = createCollectionMethod([
    {
      _id: { 'values\\_account': '1501', id: 'ent1' },
      updatedAt: '2021-01-18T00:00:00Z',
      'values.status': 'inactive',
      __totalCount: 3,
    },
    {
      _id: { 'values\\_account': '3000', id: 'ent2' },
      updatedAt: '2021-01-19T00:00:00Z',
      'values.status': 'active',
      __totalCount: 3,
    },
    {
      _id: { 'values\\_account': '3000', id: 'ent3' },
      updatedAt: '2021-01-23T00:00:00Z',
      'values.status': 'active',
      __totalCount: 3,
    },
  ])
  const countDocuments = async () => 10
  const client = createClient({ find, aggregate, countDocuments })
  const action = {
    type: 'GET',
    payload: {
      type: 'entry',
      typePlural: 'entries',
      pageSize: 2,
    },
    meta: {
      options: {
        collection: 'documents',
        db: 'database',
        aggregation: [
          { type: 'sort', sortBy: { updatedAt: -1 } },
          {
            type: 'group',
            groupBy: ['values.account', 'id'],
            values: { updatedAt: 'first', 'values.status': 'first' },
          },
        ],
      },
    },
  }
  const expectedData = [
    {
      'values.account': '1501',
      id: 'ent1',
      updatedAt: '2021-01-18T00:00:00Z',
      'values.status': 'inactive',
    },
    {
      'values.account': '3000',
      id: 'ent2',
      updatedAt: '2021-01-19T00:00:00Z',
      'values.status': 'active',
    },
  ]

  const ret = await getDocs(action, client)

  t.is(ret.status, 'ok', ret.error)
  t.is(find.callCount, 0)
  t.is(aggregate.callCount, 1)
  t.is(ret.params?.totalCount, 3)
  t.deepEqual(ret.data, expectedData)
})

test('should return the aggregated result from a page offset', async (t) => {
  const find = createCollectionMethod([])
  const aggregate = createCollectionMethod([
    {
      _id: { 'values\\_account': '1501', id: 'ent1' },
      updatedAt: '2021-01-18T00:00:00Z',
      'values.status': 'inactive',
      __totalCount: 3,
    },
    {
      _id: { 'values\\_account': '3000', id: 'ent2' },
      updatedAt: '2021-01-19T00:00:00Z',
      'values.status': 'active',
      __totalCount: 3,
    },
    {
      _id: { 'values\\_account': '3000', id: 'ent3' },
      updatedAt: '2021-01-23T00:00:00Z',
      'values.status': 'active',
      __totalCount: 3,
    },
  ])
  const countDocuments = async () => 10
  const client = createClient({ find, aggregate, countDocuments })
  const action = {
    type: 'GET',
    payload: {
      type: 'entry',
      typePlural: 'entries',
      pageSize: 2,
      pageOffset: 2,
    },
    meta: {
      options: {
        collection: 'documents',
        db: 'database',
        aggregation: [
          { type: 'sort', sortBy: { updatedAt: -1 } },
          {
            type: 'group',
            groupBy: ['values.account', 'id'],
            values: { updatedAt: 'first', 'values.status': 'first' },
          },
        ],
      },
    },
  }
  const expectedData = [
    {
      'values.account': '3000',
      id: 'ent3',
      updatedAt: '2021-01-23T00:00:00Z',
      'values.status': 'active',
    },
  ]

  const ret = await getDocs(action, client)

  t.is(ret.status, 'ok', ret.error)
  t.is(find.callCount, 0)
  t.is(aggregate.callCount, 1)
  t.deepEqual(ret.data, expectedData)
  t.is(ret.params?.totalCount, 3)
})

test('should convert mongodb _id to string', async (t) => {
  const find = createCollectionMethod([
    {
      _id: {
        // An approximation of a mongodb _id object
        id: Buffer.from('123456'),
        _bsontype: 'ObjectID',
        toString: () => '123456',
      },
      id: 'ent1',
      $type: 'entry',
    },
  ])
  const client = createClient({ find })
  const action = {
    type: 'GET',
    payload: {
      id: 'ent1',
      type: 'entry',
      typePlural: 'entries',
    },
    meta: {
      options: {
        collection: 'documents',
        db: 'database',
      },
    },
  }

  const response = await getDocs(action, client)

  t.is(response?.status, 'ok')
  const data = response?.data as TypedData[]
  t.is(data.length, 1)
  t.is(data[0].id, 'ent1')
  t.is(data[0]._id, '123456')
})

test('should get one page of items', async (t) => {
  const find = createCollectionMethod([
    { id: 'ent1', $type: 'entry' },
    { id: 'ent2', $type: 'entry' },
    { id: 'ent3', $type: 'entry' },
  ])
  const countDocuments = sinon.stub().resolves(3)
  const client = createClient({ find, countDocuments })
  const action = {
    type: 'GET',
    payload: {
      type: 'entry',
      pageSize: 2,
      typePlural: 'entries',
    },
    meta: {
      options: {
        collection: 'documents',
        db: 'database',
      },
    },
  }
  const expectedQuery = {}

  const response = await getDocs(action, client)

  t.is(response?.status, 'ok')
  const data = response?.data as TypedData[]
  t.is(data.length, 2)
  t.is(data[0].id, 'ent1')
  t.is(data[1].id, 'ent2')
  t.true(find.calledWith(expectedQuery))
  t.is(response?.params?.totalCount, 3)
  t.is(countDocuments.callCount, 1)
  t.deepEqual(countDocuments.args[0][0], {})
})

test('should return params for next page', async (t) => {
  const find = createCollectionMethod([
    { id: 'ent1', $type: 'entry' },
    { id: 'ent2', $type: 'entry' },
  ])
  const countDocuments = async () => 3
  const client = createClient({ find, countDocuments })
  const action = {
    type: 'GET',
    payload: {
      type: 'entry',
      pageSize: 2,
      typePlural: 'entries',
    },
    meta: {
      options: {
        collection: 'documents',
        db: 'database',
      },
    },
  }
  const expectedPaging = {
    next: {
      type: 'entry',
      pageId: 'ZW50Mnw+', // ent2|>
      pageSize: 2,
    },
  }

  const response = await getDocs(action, client)

  t.deepEqual(response?.paging, expectedPaging)
})

test('should get second page of items', async (t) => {
  const find = createCollectionMethod([
    { id: 'ent2', $type: 'entry' },
    { id: 'ent3', $type: 'entry' },
    { id: 'ent4', $type: 'entry' },
  ])
  const countDocuments = sinon.stub().resolves(3)
  const client = createClient({ find, countDocuments })
  const action = {
    type: 'GET',
    payload: {
      type: 'entry',
      pageSize: 2,
      pageAfter: 'ent2',
      typePlural: 'entries',
      pageId: 'ZW50Mnw+', // ent2|>
    },
    meta: {
      options: {
        collection: 'documents',
        db: 'database',
      },
    },
  }
  const expectedPaging = {
    next: {
      type: 'entry',
      pageId: 'ZW50NHw+', // ent4|>
      pageSize: 2,
    },
  }
  const expectedQuery = { id: { $gte: 'ent2' } }

  const response = await getDocs(action, client)

  t.deepEqual(find.args[0][0], expectedQuery)
  t.is(response?.status, 'ok')
  const data = response?.data as TypedData[]
  t.is(data.length, 2)
  t.is(data[0].id, 'ent3')
  t.is(data[1].id, 'ent4')
  t.deepEqual(response?.paging, expectedPaging)
  t.is(response?.params?.totalCount, 3)
  t.is(countDocuments.callCount, 1)
  t.deepEqual(countDocuments.args[0][0], {}) // Should not use pageId filters in total count
})

test('should get empty result when we have passed the last page', async (t) => {
  const find = createCollectionMethod([{ id: 'ent4', $type: 'entry' }])
  const countDocuments = async () => 3
  const client = createClient({ find, countDocuments })
  const action = {
    type: 'GET',
    payload: {
      type: 'entry',
      pageSize: 2,
      pageAfter: 'ent4',
      typePlural: 'entries',
      query: [{ path: 'id', op: 'gte', value: 'ent4' }],
    },
    meta: {
      options: {
        collection: 'documents',
        db: 'database',
      },
    },
  }
  const expectedPaging = {
    next: undefined,
  }
  const expectedQuery = { id: { $gte: 'ent4' } }

  const response = await getDocs(action, client)

  t.deepEqual(find.args[0][0], expectedQuery)
  t.is(response?.status, 'ok')
  t.is((response?.data as TypedData[]).length, 0)
  t.deepEqual(response?.paging, expectedPaging)
})

test('should get empty result when the pageAfter doc is not found', async (t) => {
  const find = createCollectionMethod([{ id: 'ent5', $type: 'entry' }])
  const countDocuments = async () => 3
  const client = createClient({ find, countDocuments })
  const action = {
    type: 'GET',
    payload: {
      type: 'entry',
      pageSize: 2,
      pageAfter: 'ent4',
      typePlural: 'entries',
      query: [{ path: 'id', op: 'gte', value: 'ent4' }],
    },
    meta: {
      options: {
        collection: 'documents',
        db: 'database',
      },
    },
  }
  const expectedPaging = {
    next: undefined,
  }
  const expectedQuery = { id: { $gte: 'ent4' } }

  const response = await getDocs(action, client)

  t.deepEqual(find.args[0][0], expectedQuery)
  t.is(response?.status, 'ok')
  t.is((response?.data as TypedData[]).length, 0)
  t.deepEqual(response?.paging, expectedPaging)
})

test('should get second page of items when there are documents before the pageAfter', async (t) => {
  const find = createCollectionMethod([
    { id: 'ent1', $type: 'entry', index: 1 },
    { id: 'ent2', $type: 'entry', index: 1 },
    { id: 'ent3', $type: 'entry', index: 2 },
    { id: 'ent4', $type: 'entry', index: 3 },
  ])
  const countDocuments = async () => 3
  const client = createClient({ find, countDocuments })
  const action = {
    type: 'GET',
    payload: {
      type: 'entry',
      pageSize: 2,
      pageId: 'ZW50MnxpbmRleD4x', // ent2|index>1
      typePlural: 'entries',
    },
    meta: {
      options: {
        collection: 'documents',
        db: 'database',
        sort: { index: 1 },
      },
    },
  }
  const expectedPaging = {
    next: {
      type: 'entry',
      pageId: 'ZW50NHxpbmRleD4z', // ent4|index>3
      pageSize: 2,
    },
  }
  const expectedQuery = { index: { $gte: 1 } }

  const response = await getDocs(action, client)

  t.deepEqual(find.args[0][0], expectedQuery)
  t.is(response?.status, 'ok')
  const data = response?.data as TypedData[]
  t.is(data.length, 2)
  t.is(data[0].id, 'ent3')
  t.is(data[1].id, 'ent4')
  t.deepEqual(response?.paging, expectedPaging)
})

test('should get second page of items - using pageOffset', async (t) => {
  const find = createCollectionMethod([
    { id: 'ent1', $type: 'entry' },
    { id: 'ent2', $type: 'entry' },
    { id: 'ent3', $type: 'entry' },
    { id: 'ent4', $type: 'entry' },
  ])
  const countDocuments = async () => 3
  const client = createClient({ find, countDocuments })
  const action = {
    type: 'GET',
    payload: {
      type: 'entry',
      pageSize: 2,
      pageOffset: 2,
    },
    meta: {
      options: {
        collection: 'documents',
        db: 'database',
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
  const expectedQuery = {}

  const response = await getDocs(action, client)

  t.deepEqual(find.args[0][0], expectedQuery)
  t.is(response?.status, 'ok')
  const data = response?.data as TypedData[]
  t.is(data.length, 2)
  t.is(data[0].id, 'ent3')
  t.is(data[1].id, 'ent4')
  t.deepEqual(response?.paging, expectedPaging)
})

test('should get empty result when we have passed the last page - using pageOffset', async (t) => {
  const find = createCollectionMethod([
    { id: 'ent1', $type: 'entry' },
    { id: 'ent2', $type: 'entry' },
    { id: 'ent3', $type: 'entry' },
    { id: 'ent4', $type: 'entry' },
  ])
  const countDocuments = async () => 3
  const client = createClient({ find, countDocuments })
  const action = {
    type: 'GET',
    payload: {
      type: 'entry',
      pageSize: 2,
      pageOffset: 4,
    },
    meta: {
      options: {
        collection: 'documents',
        db: 'database',
      },
    },
  }
  const expectedPaging = {
    next: undefined,
  }
  const expectedQuery = {}

  const response = await getDocs(action, client)

  t.deepEqual(find.args[0][0], expectedQuery)
  t.is(response?.status, 'ok')
  t.is((response?.data as TypedData[]).length, 0)
  t.deepEqual(response?.paging, expectedPaging)
})

test('should support allowDiskUse for finds', async (t) => {
  const find = createCollectionMethod([])
  const countDocuments = async () => 3
  const client = createClient({ find, countDocuments })
  const action = {
    type: 'GET',
    payload: {
      type: 'entry',
      pageId: 'ZW50MnxpbmRleD4x', // ent2|index>1
      typePlural: 'entries',
    },
    meta: {
      options: {
        collection: 'documents',
        db: 'database',
        sort: { index: 1 },
        allowDiskUse: true,
      },
    },
  }

  const response = await getDocs(action, client)

  t.is(response?.status, 'ok')
  const findOptions = find.args[0][1]
  t.true(findOptions.allowDiskUse)
})

test('should support allowDiskUse for aggregation', async (t) => {
  const find = createCollectionMethod([])
  const aggregate = createCollectionMethod([])
  const client = createClient({ find, aggregate })
  const action = {
    type: 'GET',
    payload: {
      type: 'entry',
      typePlural: 'entries',
    },
    meta: {
      options: {
        collection: 'documents',
        db: 'database',
        aggregation: [{ type: 'sort', sortBy: { updatedAt: -1 } }],
        allowDiskUse: true,
      },
    },
  }

  const ret = await getDocs(action, client)

  t.is(ret.status, 'ok')
  const aggregateOptions = aggregate.args[0][1]
  t.true(aggregateOptions.allowDiskUse)
})

test('should return empty array when collection query comes back empty', async (t) => {
  const find = createCollectionMethod([])
  const countDocuments = async () => 3
  const client = createClient({ find, countDocuments })
  const action = {
    type: 'GET',
    payload: {
      type: 'entry',
      typePlural: 'entries',
    },
    meta: {
      options: {
        collection: 'documents',
        db: 'database',
      },
    },
  }

  const response = await getDocs(action, client)

  t.is(response?.status, 'ok')
  t.is((response?.data as TypedData[]).length, 0)
})

test('should return notfound when member query comes back empty', async (t) => {
  const find = createCollectionMethod([])
  const client = createClient({ find })
  const action = {
    type: 'GET',
    payload: {
      id: 'ent1',
      type: 'entry',
      typePlural: 'entries',
    },
    meta: {
      options: {
        collection: 'documents',
        db: 'database',
      },
    },
  }

  const response = await getDocs(action, client)

  t.is(response?.status, 'notfound')
  t.is(response?.error, "Could not find 'ent1' of type 'entry'")
})

test('should return error when missing option in exchange', async (t) => {
  const find = createCollectionMethod([])
  const client = createClient({ find })
  const action = {
    type: 'GET',
    payload: {
      id: 'ent1',
      type: 'entry',
      typePlural: 'entries',
    },
  }

  const response = await getDocs(action, client)

  t.is(response?.status, 'error')
})
