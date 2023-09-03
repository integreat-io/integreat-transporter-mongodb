import ava, { TestFn } from 'ava'
import {
  uri,
  openMongoWithCollection,
  closeMongo,
  insertDocument,
  getDocuments,
  deleteDocuments,
  MongoElements,
} from './helpers/mongo.js'

import transporter from '../index.js'

const test = ava as TestFn<MongoElements>

// Helpers

const options = { uri }
const optionsWithIdIsUnique = { ...options, idIsUnique: true }
const authorization = null
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

test('should set one document', async (t) => {
  const { collection, collectionName } = t.context
  const action = {
    type: 'SET',
    payload: {
      data: {
        $type: 'entry',
        id: 'ent1',
      },
    },
    meta: {
      options: {
        collection: collectionName,
        db: 'test',
      },
    },
  }
  const expectedData = { insertedCount: 1, modifiedCount: 0, deletedCount: 0 }

  const connection = await transporter.connect(
    options,
    authorization,
    null,
    emit,
  )
  const response = await transporter.send(action, connection)
  await transporter.disconnect(connection)

  t.is(response.status, 'ok', response.error)
  const docs = (await getDocuments(collection, {
    id: 'ent1',
  })) as Record<string, unknown>[]
  t.is(docs.length, 1)
  t.is(docs[0].id, 'ent1')
  t.deepEqual(response.data, expectedData)
})

test('should set array of documents', async (t) => {
  const { collection, collectionName } = t.context
  const action = {
    type: 'SET',
    payload: {
      data: [
        { $type: 'entry', id: 'ent1' },
        { $type: 'entry', id: 'ent2' },
      ],
    },
    meta: {
      options: {
        collection: collectionName,
        db: 'test',
      },
    },
  }
  const expectedData = { insertedCount: 2, modifiedCount: 0, deletedCount: 0 }

  const connection = await transporter.connect(
    options,
    authorization,
    null,
    emit,
  )
  const response = await transporter.send(action, connection)
  await transporter.disconnect(connection)

  t.is(response.status, 'ok', response.error)
  const docs = (await getDocuments(collection, {})) as Record<string, unknown>[]
  t.is(docs.length, 2)
  t.true(docs.some((doc) => doc.id === 'ent1'))
  t.true(docs.some((doc) => doc.id === 'ent2'))
  t.deepEqual(response.data, expectedData)
})

test('should update existing document', async (t) => {
  const { collection, collectionName } = t.context
  await insertDocument(collection, {
    id: 'ent1',
    title: 'Entry 1',
    theOld: true,
    meta: { section: 'news', 'archived\\_flag': false },
  })
  const action = {
    type: 'SET',
    payload: {
      data: {
        $type: 'entry',
        id: 'ent1',
        title: 'Updated entry 1',
        theNew: true,
        date: new Date('2021-03-14T18:43:11Z'),
        meta: { section: 'oldies', 'archived.flag': true },
      },
    },
    meta: {
      options: {
        collection: collectionName,
        db: 'test',
      },
    },
  }
  const expectedData = { insertedCount: 0, modifiedCount: 1, deletedCount: 0 }

  const connection = await transporter.connect(
    options,
    authorization,
    null,
    emit,
  )
  const response = await transporter.send(action, connection)
  await transporter.disconnect(connection)

  t.is(response.status, 'ok', response.error)
  const docs = (await getDocuments(collection, {})) as Record<string, unknown>[]
  t.is(docs.length, 1)
  t.is(docs[0].id, 'ent1')
  t.true(docs[0].theNew)
  t.true(docs[0].theOld)
  t.is(docs[0].title, 'Updated entry 1')
  t.deepEqual(docs[0].date, new Date('2021-03-14T18:43:11Z'))
  t.is((docs[0].meta as Record<string, unknown>).section, 'oldies')
  t.is((docs[0].meta as Record<string, unknown>)['archived\\_flag'], true)
  t.deepEqual(response.data, expectedData)
})

test('should set id to _id when idIsUnique is true', async (t) => {
  const { collection, collectionName } = t.context
  const action = {
    type: 'SET',
    payload: {
      data: {
        $type: 'entry',
        id: 'ent1',
      },
    },
    meta: {
      options: {
        collection: collectionName,
        db: 'test',
      },
    },
  }

  const connection = await transporter.connect(
    optionsWithIdIsUnique,
    authorization,
    null,
    emit,
  )
  const response = await transporter.send(action, connection)
  await transporter.disconnect(connection)

  t.is(response.status, 'ok', response.error)
  const docs = (await getDocuments(collection, {
    _id: 'ent1',
  })) as Record<string, unknown>[]
  t.is(docs.length, 1)
  t.is(docs[0]._id, 'ent1')
  t.falsy(docs[0].id)
})

test('should set id to _id when idIsUnique is true for array of documents', async (t) => {
  const { collection, collectionName } = t.context
  const action = {
    type: 'SET',
    payload: {
      data: [
        { $type: 'entry', id: 'ent1' },
        { $type: 'entry', id: 'ent2' },
      ],
    },
    meta: {
      options: {
        collection: collectionName,
        db: 'test',
      },
    },
  }

  const connection = await transporter.connect(
    optionsWithIdIsUnique,
    authorization,
    null,
    emit,
  )
  const response = await transporter.send(action, connection)
  await transporter.disconnect(connection)

  t.is(response.status, 'ok', response.error)
  const docs = (await getDocuments(collection, {})) as Record<string, unknown>[]
  t.is(docs.length, 2)
  t.true(docs.some((doc) => doc._id === 'ent1'))
  t.true(docs.some((doc) => doc._id === 'ent2'))
})

test('should update existing document when idIsUnique is true', async (t) => {
  const { collection, collectionName } = t.context
  await insertDocument(collection, {
    _id: 'ent3',
    title: 'Entry 3',
  })
  const action = {
    type: 'SET',
    payload: {
      data: {
        $type: 'entry',
        id: 'ent3',
        title: 'Updated entry 3',
      },
    },
    meta: {
      options: {
        collection: collectionName,
        db: 'test',
      },
    },
  }
  const expectedData = { insertedCount: 0, modifiedCount: 1, deletedCount: 0 }

  const connection = await transporter.connect(
    optionsWithIdIsUnique,
    authorization,
    null,
    emit,
  )
  const response = await transporter.send(action, connection)
  await transporter.disconnect(connection)

  t.is(response.status, 'ok', response.error)
  const docs = (await getDocuments(collection, {})) as Record<string, unknown>[]
  t.is(docs.length, 1)
  t.is(docs[0]._id, 'ent3')
  t.is(docs[0].title, 'Updated entry 3')
  t.falsy(docs[0].id)
  t.deepEqual(response.data, expectedData)
})
