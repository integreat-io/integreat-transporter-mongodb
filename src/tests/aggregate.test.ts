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
const authentication = null
const emit = () => undefined

test.beforeEach(async (t) => {
  t.context = await openMongoWithCollection('test')
})

test.afterEach.always(async (t) => {
  const { client, collection } = t.context
  await deleteDocuments(collection, {})
  closeMongo(client)
})

// Tests

test('should get a document by type and id', async (t) => {
  const { collection, collectionName } = t.context
  await insertDocuments(collection, [
    {
      _id: '12345',
      id: 'ent1',
      type: 'entry',
      values: { category: 'news', count: 3 },
    },
    {
      _id: '12346',
      id: 'ent2',
      type: 'entry',
      values: { category: 'sports', count: 2 },
    },
    {
      _id: '12347',
      id: 'ent3',
      type: 'entry',
      values: { category: 'news', count: 8 },
    },
    {
      _id: '12348',
      id: 'ent4',
      type: 'entry',
      values: { category: 'news', count: 5 },
    },
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
        aggregation: [
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
    'values\\_category': 'news',
    id: 'ent1',
    'values\\_count': 16,
  }
  const expectedData2 = {
    'values\\_category': 'sports',
    id: 'ent2',
    'values\\_count': 2,
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
  const data = response.data as Record<string, unknown>[]
  t.is(data.length, 2)
  t.deepEqual(data[0], expectedData1)
  t.deepEqual(data[1], expectedData2)
  t.deepEqual(response.params?.totalCount, 2)
})
