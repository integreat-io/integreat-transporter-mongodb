import ava, { TestFn } from 'ava'
import {
  uri,
  openMongoWithCollection,
  closeMongo,
  insertDocument,
  insertDocuments,
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
  const { client } = t.context
  closeMongo(client)
})

// Tests

test.serial('should update document', async (t) => {
  const { collection, collectionName } = t.context
  await insertDocument(collection, {
    id: 'ent1',
    title: 'Entry 1',
    theOld: true,
    comments: [{ id: 'com1', text: 'Comment 1' }],
    meta: { section: 'news', 'archived\\_flag': false },
  })
  const action = {
    type: 'UPDATE',
    payload: {
      data: {
        $type: 'entry',
        id: 'ent1',
        title: 'Updated entry 1',
        theNew: true,
        date: new Date('2021-03-14T18:43:11Z'),
        text: undefined, // Should not set `undefined` values
        meta: {
          section: 'oldies',
          'archived.flag': true,
          isDeleted: undefined, // Should not set `undefined` values
        },
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
  const expectedMeta = { section: 'oldies', 'archived\\_flag': true }

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
  t.is(docs[0].title, 'Updated entry 1')
  t.true(docs[0].theNew)
  t.true(docs[0].theOld)
  t.deepEqual(docs[0].comments, [{ id: 'com1', text: 'Comment 1' }])
  t.deepEqual(docs[0].date, new Date('2021-03-14T18:43:11Z'))
  t.deepEqual(docs[0].meta, expectedMeta)
  t.false(
    docs[0].hasOwnProperty('text'),
    `'text' was ${docs[0].title}, but should not be set`,
  )
  t.deepEqual(response.data, expectedData)

  await deleteDocuments(collection, {})
})

test.serial('should update several documents', async (t) => {
  const { collection, collectionName } = t.context
  await insertDocument(collection, {
    id: 'ent2',
    title: 'Entry 2',
  })
  await insertDocument(collection, {
    id: 'ent3',
    title: 'Entry 3',
  })
  const action = {
    type: 'UPDATE',
    payload: {
      data: [
        {
          $type: 'entry',
          id: 'ent2',
          title: 'Updated entry 2',
        },
        {
          $type: 'entry',
          id: 'ent3',
          title: 'Updated entry 3',
        },
      ],
    },
    meta: {
      options: {
        collection: collectionName,
        db: 'test',
      },
    },
  }
  const expectedData = { insertedCount: 0, modifiedCount: 2, deletedCount: 0 }

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
  t.is(docs[0].id, 'ent2')
  t.is(docs[0].title, 'Updated entry 2')
  t.is(docs[1].id, 'ent3')
  t.is(docs[1].title, 'Updated entry 3')
  t.deepEqual(response.data, expectedData)

  await deleteDocuments(collection, {})
})

test.serial(
  'should return notfound when document to updated does not exist',
  async (t) => {
    const { collection, collectionName } = t.context
    const action = {
      type: 'UPDATE',
      payload: {
        data: {
          $type: 'entry',
          id: 'ent0',
          title: 'Updated entry 0',
        },
      },
      meta: {
        options: {
          collection: collectionName,
          db: 'test',
        },
      },
    }
    const expectedData = { insertedCount: 0, modifiedCount: 0, deletedCount: 0 }

    const connection = await transporter.connect(
      options,
      authorization,
      null,
      emit,
    )
    const response = await transporter.send(action, connection)
    await transporter.disconnect(connection)

    t.is(response.status, 'notfound', response.error)
    t.is(
      response.error,
      "Error updating item 'ent0' in mongodb: No documents found with the given filter",
    )
    const docs = (await getDocuments(collection, {})) as Record<
      string,
      unknown
    >[]
    t.is(docs.length, 0)
    t.deepEqual(response.data, expectedData)
  },
)

test.serial(
  'should return notfound when some of several documents to updated does not exist',
  async (t) => {
    const { collection, collectionName } = t.context
    await insertDocument(collection, {
      id: 'ent4',
      title: 'Entry 4',
    })
    const action = {
      type: 'UPDATE',
      payload: {
        data: [
          {
            $type: 'entry',
            id: 'ent4',
            title: 'Updated entry 4',
          },
          {
            $type: 'entry',
            id: 'ent0',
            title: 'Updated entry 0',
          },
        ],
      },
      meta: {
        options: {
          collection: collectionName,
          db: 'test',
        },
      },
    }
    const expectedData = {
      insertedCount: 0,
      modifiedCount: 0,
      deletedCount: 0,
    }

    const connection = await transporter.connect(
      options,
      authorization,
      null,
      emit,
    )
    const response = await transporter.send(action, connection)
    await transporter.disconnect(connection)

    t.is(response.status, 'notfound', response.error)
    t.is(
      response.error,
      "Error updating item 'ent4', 'ent0' in mongodb: One or more documents were not found with the given filter",
    )
    const docs = (await getDocuments(collection, {})) as Record<
      string,
      unknown
    >[]
    t.is(docs.length, 1)
    t.deepEqual(response.data, expectedData)

    await deleteDocuments(collection, {})
  },
)

test.serial('should update document when idIsUnique is true', async (t) => {
  const { collection, collectionName } = t.context
  await insertDocument(collection, {
    _id: 'ent5',
    title: 'Entry 5',
  })
  const action = {
    type: 'UPDATE',
    payload: {
      data: {
        $type: 'entry',
        id: 'ent5',
        title: 'Updated entry 5',
      },
    },
    meta: {
      options: {
        collection: collectionName,
        db: 'test',
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
  const docs = (await getDocuments(collection, {})) as Record<string, unknown>[]
  t.is(docs.length, 1)
  t.is(docs[0]._id, 'ent5')
  t.is(docs[0].title, 'Updated entry 5')
  t.falsy(docs[0].id)
  t.deepEqual(response.data, expectedData)

  await deleteDocuments(collection, {})
})

test.serial('should update documents by query', async (t) => {
  const { collection, collectionName } = t.context
  await insertDocuments(collection, [
    {
      id: 'ent1',
      title: 'Entry 1',
      meta: { 'archived\\_flag': false },
    },
    {
      id: 'ent2',
      title: 'Entry 2',
      meta: { 'archived\\_flag': true },
    },
    {
      id: 'ent3',
      title: 'Entry 3',
      meta: { 'archived\\_flag': true },
    },
  ])
  const action = {
    type: 'UPDATE',
    payload: {
      data: {
        isDeleted: true,
      },
    },
    meta: {
      options: {
        collection: collectionName,
        db: 'test',
        query: [{ path: 'meta.archived\\_flag', op: 'eq', value: true }],
      },
    },
  }
  const expectedData = { insertedCount: 0, modifiedCount: 2, deletedCount: 0 }

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
  t.is(docs.length, 3)
  t.is(docs[0].id, 'ent1')
  t.is(docs[0].isDeleted, undefined) // Not updated
  t.is(docs[1].id, 'ent2')
  t.is(docs[1].isDeleted, true) // Updated
  t.is(docs[2].id, 'ent3')
  t.is(docs[2].isDeleted, true) // Updated
  t.deepEqual(response.data, expectedData)

  await deleteDocuments(collection, {})
})

test.serial(
  'should respond with noaction when update query does not match any document',
  async (t) => {
    const { collection, collectionName } = t.context
    await insertDocuments(collection, [
      {
        id: 'ent1',
        title: 'Entry 1',
      },
      {
        id: 'ent2',
        title: 'Entry 2',
      },
    ])
    const action = {
      type: 'UPDATE',
      payload: {
        data: {
          isDeleted: true,
        },
      },
      meta: {
        options: {
          collection: collectionName,
          db: 'test',
          query: [{ path: 'meta.archived\\_flag', op: 'eq', value: true }], // None will match this
        },
      },
    }
    const expectedData = { insertedCount: 0, modifiedCount: 0, deletedCount: 0 }

    const connection = await transporter.connect(
      options,
      authorization,
      null,
      emit,
    )
    const response = await transporter.send(action, connection)
    await transporter.disconnect(connection)

    t.is(response.status, 'noaction', response.error)
    const docs = (await getDocuments(collection, {})) as Record<
      string,
      unknown
    >[]
    t.is(docs.length, 2)
    t.is(docs[0].isDeleted, undefined) // Not updated
    t.is(docs[0].isDeleted, undefined) // Not updated
    t.deepEqual(response.data, expectedData)

    await deleteDocuments(collection, {})
  },
)
