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

import transporter from '..'

const test = ava as TestInterface<MongoElements>

// Helpers

const options = { uri }
const authentication = null

test.beforeEach(async (t) => {
  t.context = await openMongoWithCollection('test')
})

test.afterEach.always(async (t) => {
  const { client, collection } = t.context
  await deleteDocuments(collection, { '\\$type': 'entry' })
  closeMongo(client)
})

// Tests

test('should get a document by type and id', async (t) => {
  const { collection, collectionName } = t.context
  await insertDocuments(collection, [
    {
      _id: 'entry:ent1',
      id: 'ent1',
      '\\$type': 'entry',
      values: { category: 'news', count: 3 },
    },
    {
      _id: 'entry:ent2',
      id: 'ent2',
      '\\$type': 'entry',
      values: { category: 'sports', count: 2 },
    },
    {
      _id: 'entry:ent3',
      id: 'ent3',
      '\\$type': 'entry',
      values: { category: 'news', count: 8 },
    },
  ])
  const exchange = {
    ...defaultExchange,
    type: 'GET',
    request: {
      type: 'entry',
    },
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
  }
  const expectedData1 = {
    'values.category': 'news',
    id: 'ent1',
    'values.count': 11,
  }
  const expectedData2 = {
    'values.category': 'sports',
    id: 'ent2',
    'values.count': 2,
  }

  const connection = await transporter.connect(options, authentication, null)
  const { status, response } = await transporter.send(exchange, connection)
  await transporter.disconnect(connection)

  t.truthy(response)
  t.is(status, 'ok')
  const data = response.data as Record<string, unknown>[]
  t.is(data.length, 2)
  t.deepEqual(data[0], expectedData1)
  t.deepEqual(data[1], expectedData2)
})
