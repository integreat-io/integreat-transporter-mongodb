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

const dbName = 'test_1'
const options = { uri }
const optionsWithIdIsUnique = { ...options, idIsUnique: true }
const authorization = null
const emit = () => undefined

test.beforeEach(async (t) => {
  t.context = await openMongoWithCollection(dbName)
})

test.afterEach.always(async (t) => {
  const { client, collection } = t.context
  await deleteDocuments(collection, {})
  closeMongo(client)
})

// Tests

test.serial('should set one document', async (t) => {
  const { collection, collectionName } = t.context
  const action = {
    type: 'SET',
    payload: {
      data: {
        $type: 'entry',
        id: 'ent1',
        title: undefined, // Should not set `undefined` values
        '': 'Empty',
      },
    },
    meta: {
      options: {
        collection: collectionName,
        db: dbName,
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
  t.is(docs[0]['\\$type'], 'entry') // Should escape `$type` key
  t.is(docs[0]['**empty**'], 'Empty') // Should use replacement for empty string used as key
  t.false(
    docs[0].hasOwnProperty('title'),
    `'title' was ${docs[0].title}, but should not be set`,
  )
  t.deepEqual(response.data, expectedData)
})

test.serial('should set array of documents', async (t) => {
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
        db: dbName,
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

test.serial('should update existing document', async (t) => {
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
        db: dbName,
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

test.serial('should keep undefined when keepUndefined is true', async (t) => {
  const { collection, collectionName } = t.context
  const action = {
    type: 'SET',
    payload: {
      data: {
        $type: 'entry',
        id: 'ent1',
        title: undefined,
        meta: { section: 'news', archived: undefined },
      },
    },
    meta: {
      options: {
        collection: collectionName,
        db: dbName,
        keepUndefined: true,
      },
    },
  }

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
  t.is(docs[0]['\\$type'], 'entry') // Should escape `$type` key
  t.is(docs[0].title, null) // Mongo turns `undefined` into `null`
  t.deepEqual(docs[0].meta, { section: 'news', archived: null })
})

test.serial('should set id to _id when idIsUnique is true', async (t) => {
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
        db: dbName,
        idIsUnique: true,
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

test.serial(
  'should set id to _id when idIsUnique is true for array of documents',
  async (t) => {
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
          db: dbName,
          idIsUnique: true,
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
    const docs = (await getDocuments(collection, {})) as Record<
      string,
      unknown
    >[]
    t.is(docs.length, 2)
    t.true(docs.some((doc) => doc._id === 'ent1'))
    t.true(docs.some((doc) => doc._id === 'ent2'))
  },
)

test.serial(
  'should update existing document when idIsUnique is true',
  async (t) => {
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
          db: dbName,
          idIsUnique: true,
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
    const docs = (await getDocuments(collection, {})) as Record<
      string,
      unknown
    >[]
    t.is(docs.length, 1)
    t.is(docs[0]._id, 'ent3')
    t.is(docs[0].title, 'Updated entry 3')
    t.falsy(docs[0].id)
    t.deepEqual(response.data, expectedData)
  },
)
