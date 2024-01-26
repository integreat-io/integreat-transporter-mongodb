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
  },
  {
    _id: '12346',
    id: 'ent2',
    type: 'entry',
    values: { category: 'sports', count: 2 },
    user: 'user1',
  },
  {
    _id: '12347',
    id: 'ent3',
    type: 'entry',
    values: { category: 'news', count: 8 },
    user: 'user2',
  },
  {
    _id: '12348',
    id: 'ent4',
    type: 'entry',
    values: { category: 'news', count: 5 },
    user: 'user3',
  },
  {
    _id: 'user2', // Looks strange, but we're switching the users when fetching by `_id`
    id: 'user1',
    type: 'user',
    name: 'User 1',
  },
  {
    _id: 'user1', // Looks strange, but we're switching the users when fetching by `_id`
    id: 'user2',
    type: 'user',
    name: 'User 2',
  },
  {
    _id: 'user3',
    id: 'user3',
    type: 'user',
    name: 'User 3',
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
      user: [{ _id: 'user2', id: 'user1', name: 'User 1', type: 'user' }],
    },
    {
      _id: '12346',
      id: 'ent2',
      type: 'entry',
      values: { category: 'sports', count: 2 },
      user: [{ _id: 'user2', id: 'user1', name: 'User 1', type: 'user' }],
    },
    {
      _id: '12347',
      id: 'ent3',
      type: 'entry',
      values: { category: 'news', count: 8 },
      user: [{ _id: 'user1', id: 'user2', name: 'User 2', type: 'user' }],
    },
    {
      _id: '12348',
      id: 'ent4',
      type: 'entry',
      values: { category: 'news', count: 5 },
      user: [{ _id: 'user3', id: 'user3', name: 'User 3', type: 'user' }],
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
    id: '12345',
    'values\\_category': 'news',
    'values\\_count': 16,
  }
  const expectedData2 = {
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
      user: [{ id: 'user1', name: 'User 2', type: 'user' }],
    },
    {
      id: '12346',
      type: 'entry',
      values: { category: 'sports', count: 2 },
      user: [{ id: 'user1', name: 'User 2', type: 'user' }],
    },
    {
      id: '12347',
      type: 'entry',
      values: { category: 'news', count: 8 },
      user: [{ id: 'user2', name: 'User 1', type: 'user' }],
    },
    {
      id: '12348',
      type: 'entry',
      values: { category: 'news', count: 5 },
      user: [{ id: 'user3', name: 'User 3', type: 'user' }],
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
