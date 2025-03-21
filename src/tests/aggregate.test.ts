import ava, { TestFn } from 'ava'
import {
  uri,
  openMongoWithCollection,
  closeMongo,
  insertDocuments,
  deleteDocuments,
  MongoElements,
} from './helpers/mongo.js'

import transporter from '../index.js'

const test = ava as TestFn<MongoElements>

// Helpers

const options = { uri }
const optionsWithIdIsUnique = { ...options, idIsUnique: true }
const authentication = null
const emit = () => undefined

const docs = [
  {
    _id: '12345',
    id: 'ent1',
    type: 'entry',
    values: { category: 'news', count: 3 },
    user: 'user1',
    createdAt: new Date('2024-11-18T18:43:11+01:00'),
  },
  {
    _id: '12346',
    id: 'ent2',
    type: 'entry',
    values: { category: 'sports', count: 2 },
    user: 'user1',
    createdAt: new Date('2024-11-18T20:09:14+01:00'),
  },
  {
    _id: '12347',
    id: 'ent3',
    type: 'entry',
    values: { category: 'news', count: 8 },
    user: 'user2',
    createdAt: new Date('2024-11-18T14:11:55+01:00'),
  },
  {
    _id: '12348',
    id: 'ent4',
    type: 'entry',
    values: { category: 'news', count: 5 },
    user: 'user3',
    createdAt: new Date('2024-11-18T20:10:37+01:00'),
  },
  {
    _id: 'user2', // Looks strange, but we're switching the users when fetching by `_id`
    id: 'user1',
    type: 'user',
    name: 'User 1',
    createdAt: new Date('2024-11-18T20:15:33+01:00'),
  },
  {
    _id: 'user1', // Looks strange, but we're switching the users when fetching by `_id`
    id: 'user2',
    type: 'user',
    name: 'User 2',
    createdAt: new Date('2024-11-18T21:04:04+01:00'),
  },
  {
    _id: 'user3',
    id: 'user3',
    type: 'user',
    name: 'User 3',
    createdAt: new Date('2024-11-19T01:18:11+01:00'),
  },
]

test.before(async (t) => {
  t.context = await openMongoWithCollection('test')

  const { collection } = t.context
  await insertDocuments(collection, docs)
})

test.after.always(async (t) => {
  const { client, collection } = t.context
  await deleteDocuments(collection, {})
  closeMongo(client)
})

// Tests

test('should get documents by aggregation', async (t) => {
  const { collectionName } = t.context
  const action = {
    type: 'GET',
    payload: {
      type: 'entry',
    },
    meta: {
      options: {
        collection: collectionName,
        db: 'test',
        aggregation: [
          {
            type: 'query',
            query: [{ path: 'type', value: 'entry' }],
          },
          {
            type: 'group',
            groupBy: ['values.category'],
            values: { 'values.count': 'sum', id: 'first' },
          },
          {
            type: 'sort',
            sortBy: { id: 1 },
          },
        ],
      },
    },
  }
  const expectedData1 = {
    _id: { 'values\\_category': 'news' },
    id: 'ent1',
    'values\\_category': 'news',
    'values\\_count': 16,
  }
  const expectedData2 = {
    _id: { 'values\\_category': 'sports' },
    id: 'ent2',
    'values\\_category': 'sports',
    'values\\_count': 2,
  }

  const connection = await transporter.connect(
    options,
    authentication,
    null,
    emit,
  )
  const response = await transporter.send(action, connection)
  await transporter.disconnect(connection)

  t.truthy(response)
  t.is(response.status, 'ok', response.error)
  const data = response.data as Record<string, unknown>[]
  t.is(data.length, 2)
  t.deepEqual(data[0], expectedData1)
  t.deepEqual(data[1], expectedData2)
  t.deepEqual(response.params?.totalCount, 2)
})

test('should get first page of documents by aggregation', async (t) => {
  const { collectionName } = t.context
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
        aggregation: [
          {
            type: 'query',
            query: [{ path: 'type', value: 'entry' }],
          },
          {
            type: 'group',
            groupBy: ['user'],
            values: { 'values.count': 'sum' },
          },
          {
            type: 'sort',
            sortBy: { _id: 1 },
          },
        ],
      },
    },
  }
  const expectedData1 = {
    _id: { user: 'user1' },
    user: 'user1',
    'values\\_count': 5,
  }
  const expectedData2 = {
    _id: { user: 'user2' },
    user: 'user2',
    'values\\_count': 8,
  }
  const expectedPaging = {
    next: {
      pageId: 'fHVzZXJ8InVzZXIyIg', // |user|"user2"
      pageSize: 2,
      type: 'entry',
    },
  }

  const connection = await transporter.connect(
    options,
    authentication,
    null,
    emit,
  )
  const response = await transporter.send(action, connection)
  await transporter.disconnect(connection)

  t.truthy(response)
  t.is(response.status, 'ok', response.error)
  t.deepEqual(response.paging, expectedPaging)
  const data = response.data as Record<string, unknown>[]
  t.is(data.length, 2)
  t.deepEqual(data[0], expectedData1)
  t.deepEqual(data[1], expectedData2)
  t.deepEqual(response.params?.totalCount, 3)
})

test('should get first page of documents by aggregation without group', async (t) => {
  const { collectionName } = t.context
  const action = {
    type: 'GET',
    payload: {
      pageSize: 4,
    },
    meta: {
      options: {
        collection: collectionName,
        db: 'test',
        aggregation: [
          {
            type: 'set',
            values: {
              isUser: { expr: { path: 'type', op: 'eq', value: 'user' } },
            },
          },
          { type: 'sort', sortBy: { isUser: -1, createdAt: -1 } },
        ],
      },
    },
  }
  const expectedPaging = {
    next: {
      pageId: 'ImVudDQifD4', // "ent4"
      pageSize: 4,
    },
  }

  const connection = await transporter.connect(
    options,
    authentication,
    null,
    emit,
  )
  const response = await transporter.send(action, connection)
  await transporter.disconnect(connection)

  t.truthy(response)
  t.is(response.status, 'ok', response.error)
  const data = response.data as Record<string, unknown>[]
  t.is(data.length, 4)
  t.is(data[0].id, 'user3')
  t.is(data[1].id, 'user2')
  t.is(data[2].id, 'user1')
  t.is(data[3].id, 'ent4')
  t.deepEqual(response.params?.totalCount, 7)
  t.deepEqual(response.paging, expectedPaging)
})

test('should get second page of documents by aggregation without group', async (t) => {
  const { collectionName } = t.context
  const action = {
    type: 'GET',
    payload: {
      pageSize: 4,
      pageId: 'ImVudDQifD4', // "ent4"
    },
    meta: {
      options: {
        collection: collectionName,
        db: 'test',
        aggregation: [
          {
            type: 'set',
            values: {
              isUser: { expr: { path: 'type', op: 'eq', value: 'user' } },
            },
          },
          { type: 'sort', sortBy: { isUser: -1, createdAt: -1 } },
        ],
      },
    },
  }
  const expectedPaging = { next: undefined }

  const connection = await transporter.connect(
    options,
    authentication,
    null,
    emit,
  )
  const response = await transporter.send(action, connection)
  await transporter.disconnect(connection)

  t.truthy(response)
  t.is(response.status, 'ok', response.error)
  const data = response.data as Record<string, unknown>[]
  t.is(data.length, 3)
  t.is(data[0].id, 'ent2')
  t.is(data[1].id, 'ent1')
  t.is(data[2].id, 'ent3')
  t.deepEqual(response.params?.totalCount, 7)
  t.deepEqual(response.paging, expectedPaging)
})

test('should get second page of documents by aggregation', async (t) => {
  const { collectionName } = t.context
  const action = {
    type: 'GET',
    payload: {
      type: 'entry',
      pageSize: 2,
      pageId: 'fHVzZXJ8InVzZXIyIg', // |user|"user2"
    },
    meta: {
      options: {
        collection: collectionName,
        db: 'test',
        aggregation: [
          {
            type: 'query',
            query: [{ path: 'type', value: 'entry' }],
          },
          {
            type: 'group',
            groupBy: ['user'],
            values: { 'values.count': 'sum' },
          },
          {
            type: 'sort',
            sortBy: { _id: 1 },
          },
        ],
      },
    },
  }
  const expectedData3 = {
    _id: { user: 'user3' },
    user: 'user3',
    'values\\_count': 5,
  }
  const expectedPaging = {
    next: undefined,
  }

  const connection = await transporter.connect(
    options,
    authentication,
    null,
    emit,
  )
  const response = await transporter.send(action, connection)
  await transporter.disconnect(connection)

  t.truthy(response)
  t.is(response.status, 'ok', response.error)
  const data = response.data as Record<string, unknown>[]
  t.is(data.length, 1)
  t.deepEqual(data[0], expectedData3)
  t.deepEqual(response.params?.totalCount, 3)
  t.deepEqual(response.paging, expectedPaging)
})

test('should aggregate with expressions in group', async (t) => {
  const { collectionName } = t.context
  const action = {
    type: 'GET',
    payload: {
      type: 'entry',
    },
    meta: {
      options: {
        collection: collectionName,
        db: 'test',
        aggregation: [
          {
            type: 'query',
            query: [{ path: 'type', value: 'entry' }],
          },
          {
            type: 'group',
            groupBy: {
              y: { op: 'year', path: 'createdAt' },
              d: { op: 'dayOfYear', path: 'createdAt' },
              h: { op: 'hour', path: 'createdAt' },
              type: { op: 'field', path: 'type' },
            },
            values: { 'values.count': 'sum', id: 'first' },
          },
          {
            type: 'sort',
            sortBy: { id: 1 },
          },
        ],
      },
    },
  }
  const expectedData1 = {
    _id: { y: 2024, d: 323, h: 17, type: 'entry' },
    id: 'ent1',
    y: 2024,
    d: 323,
    h: 17,
    type: 'entry',
    'values\\_count': 3,
  }
  const expectedData2 = {
    _id: { y: 2024, d: 323, h: 19, type: 'entry' },
    id: 'ent2',
    y: 2024,
    d: 323,
    h: 19,
    type: 'entry',
    'values\\_count': 7,
  }
  const expectedData3 = {
    _id: { y: 2024, d: 323, h: 13, type: 'entry' },
    id: 'ent3',
    y: 2024,
    d: 323,
    h: 13,
    type: 'entry',
    'values\\_count': 8,
  }

  const connection = await transporter.connect(
    options,
    authentication,
    null,
    emit,
  )
  const response = await transporter.send(action, connection)
  await transporter.disconnect(connection)

  t.truthy(response)
  t.is(response.status, 'ok', response.error)
  const data = response.data as Record<string, unknown>[]
  t.is(data.length, 3)
  t.deepEqual(data[0], expectedData1)
  t.deepEqual(data[1], expectedData2)
  t.deepEqual(data[2], expectedData3)
  t.deepEqual(response.params?.totalCount, 3)
})

test('should aggregate with lookup', async (t) => {
  const { collectionName } = t.context
  const action = {
    type: 'GET',
    payload: {
      type: 'entry',
    },
    meta: {
      options: {
        collection: collectionName,
        db: 'test',
        aggregation: [
          {
            type: 'query',
            query: [{ path: 'type', value: 'entry' }],
          },
          {
            type: 'lookup',
            collection: collectionName,
            field: 'id',
            path: 'user',
            pipeline: [
              {
                type: 'query',
                query: [{ path: 'type', value: 'user' }],
              },
            ],
          },
          {
            type: 'sort',
            sortBy: { id: 1 },
          },
        ],
      },
    },
  }
  const expectedData = [
    {
      _id: '12345',
      id: 'ent1',
      type: 'entry',
      values: { category: 'news', count: 3 },
      createdAt: new Date('2024-11-18T18:43:11+01:00'),
      user: [
        {
          _id: 'user2',
          id: 'user1',
          name: 'User 1',
          type: 'user',
          createdAt: new Date('2024-11-18T20:15:33+01:00'),
        },
      ],
    },
    {
      _id: '12346',
      id: 'ent2',
      type: 'entry',
      values: { category: 'sports', count: 2 },
      createdAt: new Date('2024-11-18T20:09:14+01:00'),
      user: [
        {
          _id: 'user2',
          id: 'user1',
          name: 'User 1',
          type: 'user',
          createdAt: new Date('2024-11-18T20:15:33+01:00'),
        },
      ],
    },
    {
      _id: '12347',
      id: 'ent3',
      type: 'entry',
      values: { category: 'news', count: 8 },
      createdAt: new Date('2024-11-18T14:11:55+01:00'),
      user: [
        {
          _id: 'user1',
          id: 'user2',
          name: 'User 2',
          type: 'user',
          createdAt: new Date('2024-11-18T21:04:04+01:00'),
        },
      ],
    },
    {
      _id: '12348',
      id: 'ent4',
      type: 'entry',
      createdAt: new Date('2024-11-18T20:10:37+01:00'),
      values: { category: 'news', count: 5 },
      user: [
        {
          _id: 'user3',
          id: 'user3',
          name: 'User 3',
          type: 'user',
          createdAt: new Date('2024-11-19T01:18:11+01:00'),
        },
      ],
    },
  ]

  const connection = await transporter.connect(
    options,
    authentication,
    null,
    emit,
  )
  const response = await transporter.send(action, connection)
  await transporter.disconnect(connection)

  t.truthy(response)
  t.is(response.status, 'ok', response.error)
  const data = response.data as Record<string, unknown>[]
  t.deepEqual(data, expectedData)
  t.deepEqual(response.params?.totalCount, 4)
})

test('should get documents by aggregation when idIsUnique is true', async (t) => {
  const { collectionName } = t.context
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
        idIsUnique: true,
        aggregation: [
          {
            type: 'query',
            query: [{ path: 'type', value: 'entry' }],
          },
          {
            type: 'group',
            groupBy: ['values.category'],
            values: { 'values.count': 'sum', id: 'first' },
          },
          {
            type: 'sort',
            sortBy: { id: 1 },
          },
        ],
      },
    },
  }
  const expectedData1 = {
    _id: { 'values\\_category': 'news' },
    id: '12345',
    'values\\_category': 'news',
    'values\\_count': 16,
  }
  const expectedData2 = {
    _id: { 'values\\_category': 'sports' },
    id: '12346',
    'values\\_category': 'sports',
    'values\\_count': 2,
  }

  const connection = await transporter.connect(
    optionsWithIdIsUnique,
    authentication,
    null,
    emit,
  )
  const response = await transporter.send(action, connection)
  await transporter.disconnect(connection)

  t.truthy(response)
  t.is(response.status, 'ok', response.error)
  const data = response.data as Record<string, unknown>[]
  t.is(data.length, 2)
  t.deepEqual(data[0], expectedData1)
  t.deepEqual(data[1], expectedData2)
  t.deepEqual(response.params?.totalCount, 2)
})

test('should aggregate with lookup when idIsUnique is true', async (t) => {
  const { collectionName } = t.context
  const action = {
    type: 'GET',
    payload: {
      type: 'entry',
    },
    meta: {
      options: {
        collection: collectionName,
        db: 'test',
        idIsUnique: true,
        aggregation: [
          {
            type: 'query',
            query: [{ path: 'type', value: 'entry' }],
          },
          {
            type: 'lookup',
            collection: collectionName,
            field: 'id',
            path: 'user',
            pipeline: [
              {
                type: 'query',
                query: [{ path: 'type', value: 'user' }],
              },
            ],
          },
          {
            type: 'sort',
            sortBy: { id: 1 },
          },
        ],
      },
    },
  }
  const expectedData = [
    {
      id: '12345',
      type: 'entry',
      values: { category: 'news', count: 3 },
      createdAt: new Date('2024-11-18T18:43:11+01:00'),
      user: [
        {
          id: 'user1',
          name: 'User 2',
          type: 'user',
          createdAt: new Date('2024-11-18T21:04:04+01:00'),
        },
      ],
    },
    {
      id: '12346',
      type: 'entry',
      values: { category: 'sports', count: 2 },
      createdAt: new Date('2024-11-18T20:09:14+01:00'),
      user: [
        {
          id: 'user1',
          name: 'User 2',
          type: 'user',
          createdAt: new Date('2024-11-18T21:04:04+01:00'),
        },
      ],
    },
    {
      id: '12347',
      type: 'entry',
      createdAt: new Date('2024-11-18T14:11:55+01:00'),
      values: { category: 'news', count: 8 },
      user: [
        {
          id: 'user2',
          name: 'User 1',
          type: 'user',
          createdAt: new Date('2024-11-18T20:15:33+01:00'),
        },
      ],
    },
    {
      id: '12348',
      type: 'entry',
      values: { category: 'news', count: 5 },
      createdAt: new Date('2024-11-18T20:10:37+01:00'),
      user: [
        {
          id: 'user3',
          name: 'User 3',
          type: 'user',
          createdAt: new Date('2024-11-19T01:18:11+01:00'),
        },
      ],
    },
  ]

  const connection = await transporter.connect(
    optionsWithIdIsUnique,
    authentication,
    null,
    emit,
  )
  const response = await transporter.send(action, connection)
  await transporter.disconnect(connection)

  t.is(response.status, 'ok', response.error)
  const data = response.data as Record<string, unknown>[]
  t.deepEqual(data, expectedData)
  t.deepEqual(response.params?.totalCount, 4)
})

test('should get first page of more complex aggregation when idIsUnique is true', async (t) => {
  const { collectionName } = t.context
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
        idIsUnique: true,
        aggregation: [
          {
            type: 'query',
            query: [{ path: 'type', value: 'entry' }],
          },
          {
            type: 'group',
            groupBy: ['values.category', 'values.count'],
            values: { user: 'first' },
          },
          {
            type: 'sort',
            sortBy: { _id: -1 },
          },
        ],
      },
    },
  }
  const expectedData = [
    {
      _id: {
        'values\\_category': 'sports',
        'values\\_count': 2,
      },
      user: 'user1',
      'values\\_category': 'sports',
      'values\\_count': 2,
    },
    {
      _id: {
        'values\\_category': 'news',
        'values\\_count': 8,
      },
      user: 'user2',
      'values\\_category': 'news',
      'values\\_count': 8,
    },
  ]
  const expectedPaging = {
    next: {
      pageId: 'fHZhbHVlc1xfY2F0ZWdvcnl8Im5ld3MifHZhbHVlc1xfY291bnR8OA', // |values\_category|"news"|values\_count|8
      pageSize: 2,
      type: 'entry',
    },
  }

  const connection = await transporter.connect(
    optionsWithIdIsUnique,
    authentication,
    null,
    emit,
  )
  const response = await transporter.send(action, connection)
  await transporter.disconnect(connection)

  t.is(response.status, 'ok', response.error)
  const data = response.data as Record<string, unknown>[]
  t.deepEqual(data, expectedData)
  t.deepEqual(response.params?.totalCount, 4)
  t.deepEqual(response.paging, expectedPaging)
})

test('should get second page of more complex aggregation when idIsUnique is true', async (t) => {
  const { collectionName } = t.context
  const action = {
    type: 'GET',
    payload: {
      type: 'entry',
      pageSize: 2,
      pageId: 'fHZhbHVlc1xfY2F0ZWdvcnl8Im5ld3MifHZhbHVlc1xfY291bnR8OA', // |values\_category|"news"|values\_count|8
    },
    meta: {
      options: {
        collection: collectionName,
        db: 'test',
        idIsUnique: true,
        aggregation: [
          {
            type: 'query',
            query: [{ path: 'type', value: 'entry' }],
          },
          {
            type: 'group',
            groupBy: ['values.category', 'values.count'],
            values: { user: 'first' },
          },
          {
            type: 'sort',
            sortBy: { _id: -1 },
          },
        ],
      },
    },
  }
  const expectedData = [
    {
      _id: {
        'values\\_category': 'news',
        'values\\_count': 5,
      },
      user: 'user3',
      'values\\_category': 'news',
      'values\\_count': 5,
    },
    {
      _id: {
        'values\\_category': 'news',
        'values\\_count': 3,
      },
      user: 'user1',
      'values\\_category': 'news',
      'values\\_count': 3,
    },
  ]
  const expectedPaging = {
    next: {
      pageId: 'fHZhbHVlc1xfY2F0ZWdvcnl8Im5ld3MifHZhbHVlc1xfY291bnR8Mw', // |values\_category|"news"|values\_count|3
      pageSize: 2,
      type: 'entry',
    },
  }

  const connection = await transporter.connect(
    optionsWithIdIsUnique,
    authentication,
    null,
    emit,
  )
  const response = await transporter.send(action, connection)
  await transporter.disconnect(connection)

  t.is(response.status, 'ok', response.error)
  const data = response.data as Record<string, unknown>[]
  t.deepEqual(data, expectedData)
  t.deepEqual(response.params?.totalCount, 4)
  t.deepEqual(response.paging, expectedPaging)
})

test('should handle empty steps in an aggregation', async (t) => {
  const { collectionName } = t.context
  const action = {
    type: 'GET',
    payload: {
      type: 'entry',
    },
    meta: {
      options: {
        collection: collectionName,
        db: 'test',
        idIsUnique: true,
        aggregation: [
          {
            type: 'query',
            query: [{ path: 'type', value: 'entry' }],
          },
          null,
          {
            type: 'lookup',
            collection: collectionName,
            field: 'id',
            path: 'user',
            pipeline: [
              {
                type: 'query',
                query: [{ path: 'type', value: 'user' }],
              },
            ],
          },
          {
            type: 'sort',
            sortBy: { id: 1 },
          },
        ],
      },
    },
  }

  const connection = await transporter.connect(
    optionsWithIdIsUnique,
    authentication,
    null,
    emit,
  )
  const response = await transporter.send(action, connection)
  await transporter.disconnect(connection)

  t.is(response.status, 'ok', response.error) // If we get a response, we did not throw
  t.true(Array.isArray(response.data))
  t.is((response.data as unknown[]).length, 4)
})
