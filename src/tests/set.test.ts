import ava, { TestInterface } from 'ava'
import {
  uri,
  openMongoWithCollection,
  closeMongo,
  insertDocument,
  getDocuments,
  deleteDocuments,
  MongoElements,
} from './helpers/mongo'
import defaultExchange from './helpers/defaultExchange'

import adapter from '..'

const test = ava as TestInterface<MongoElements>

// Helpers

const options = { uri }
const authorization = null

test.beforeEach(async (t) => {
  t.context = await openMongoWithCollection('test')
})

test.afterEach.always(async (t) => {
  const { client, collection } = t.context
  deleteDocuments(collection, { '\\$type': 'entry' })
  closeMongo(client)
})

// Tests

test('should set one document', async (t) => {
  const { collection, collectionName } = t.context
  const exchange = {
    ...defaultExchange,
    type: 'SET',
    request: {
      data: {
        $type: 'entry',
        id: 'ent1',
      },
    },
    options: {
      collection: collectionName,
      db: 'test',
    },
  }

  const connection = await adapter.connect(options, authorization, null)
  const { status, response } = await adapter.send(exchange, connection)
  await adapter.disconnect(connection)

  t.is(status, 'ok', response.error)
  const docs = (await getDocuments(collection, {
    _id: 'entry:ent1',
  })) as Record<string, unknown>[]
  t.is(docs.length, 1)
  t.is(docs[0].id, 'ent1')
})

test('should set array of documents', async (t) => {
  const { collection, collectionName } = t.context
  const exchange = {
    ...defaultExchange,
    type: 'SET',
    request: {
      data: [
        { $type: 'entry', id: 'ent1' },
        { $type: 'entry', id: 'ent2' },
      ],
    },
    options: {
      collection: collectionName,
      db: 'test',
    },
  }

  const connection = await adapter.connect(options, authorization, null)
  const { status, response } = await adapter.send(exchange, connection)
  await adapter.disconnect(connection)

  t.is(status, 'ok', response.error)
  const docs = (await getDocuments(collection, {
    '\\$type': 'entry',
  })) as Record<string, unknown>[]
  t.is(docs.length, 2)
  t.true(docs.some((doc) => doc._id === 'entry:ent1'))
  t.true(docs.some((doc) => doc._id === 'entry:ent2'))
})

test('should update existing document', async (t) => {
  const { collection, collectionName } = t.context
  await insertDocument(collection, {
    _id: 'entry:ent1',
    id: 'ent1',
    '\\$type': 'entry',
    title: 'Entry 1',
    theOld: true,
    meta: { section: 'news', 'archived\\_flag': false },
  })
  const exchange = {
    ...defaultExchange,
    type: 'SET',
    request: {
      data: {
        $type: 'entry',
        id: 'ent1',
        title: 'Updated entry 1',
        theNew: true,
        meta: { section: 'oldies', 'archived.flag': true },
      },
    },
    options: {
      collection: collectionName,
      db: 'test',
    },
  }

  const connection = await adapter.connect(options, authorization, null)
  const { status, response } = await adapter.send(exchange, connection)
  await adapter.disconnect(connection)

  t.is(status, 'ok', response.error)
  const docs = (await getDocuments(collection, {
    '\\$type': 'entry',
  })) as Record<string, unknown>[]
  t.is(docs.length, 1)
  t.is(docs[0].id, 'ent1')
  t.true(docs[0].theNew)
  t.true(docs[0].theOld)
  t.is(docs[0].title, 'Updated entry 1')
  t.is((docs[0].meta as Record<string, unknown>).section, 'oldies')
  t.is((docs[0].meta as Record<string, unknown>)['archived\\_flag'], true)
})
