import ava, { TestFn } from 'ava'
import {
  uri,
  openMongoWithCollection,
  closeMongo,
  insertDocuments,
  deleteDocuments,
  MongoElements,
} from './helpers/mongo.js'
import type { TypedData } from 'integreat'

import transporter from '../index.js'

const test = ava as TestFn<MongoElements>

// Helpers

const options = { uri }
const optionsWithIdIsUnique = { ...options, idIsUnique: true }
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

test.serial('should get a document by id', async (t) => {
  const { collection, collectionName } = t.context
  await insertDocuments(collection, [
    {
      _id: '12345',
      id: 'ent1',
      date: new Date('2021-03-14T18:43:11Z'),
      '**empty**': 'Empty',
    },
    {
      _id: '12346',
      id: 'ent2',
      date: new Date('2021-03-14T18:51:09Z'),
    },
  ])
  const action = {
    type: 'GET',
    payload: {
      type: 'entry',
      id: 'ent1',
    },
    meta: {
      options: {
        collection: collectionName,
        db: 'test',
      },
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
  const data = response.data as TypedData[]
  t.is(data.length, 1)
  t.is(data[0].id, 'ent1')
  t.deepEqual(data[0].date, new Date('2021-03-14T18:43:11Z'))
  t.is(data[0][''], 'Empty') // Should normalize `'**empty**'` to empty string when used as key
  t.false(data[0].hasOwnProperty('**empty**'))
})

test.serial('should get documents by type', async (t) => {
  const { collection, collectionName } = t.context
  await insertDocuments(collection, [
    { _id: '12345', id: 'ent1', type: 'entry' },
    { _id: '12346', id: 'ent2', type: 'entry' },
  ])
  const action = {
    type: 'GET',
    payload: {
      type: 'entry',
    },
    meta: {
      options: {
        collection: collectionName,
        db: 'test',
      },
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
  const data = response.data as TypedData[]
  t.is(data.length, 2)
  t.is(data[0].id, 'ent1')
  t.is(data[1].id, 'ent2')
})

test.serial('should get documents with pagination', async (t) => {
  const { collection, collectionName } = t.context
  await insertDocuments(collection, [
    { _id: '12345', id: 'ent1', type: 'entry' },
    { _id: '12346', id: 'ent2', type: 'entry' },
    { _id: '12347', id: 'ent3', type: 'entry' },
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
      },
    },
  }
  const expectedPaging = {
    next: {
      pageId: 'ZW50Mnw+',
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
  const data = response.data as TypedData[]
  t.is(data.length, 2)
  t.is(data[0].id, 'ent1')
  t.is(data[1].id, 'ent2')
  t.deepEqual(response.paging, expectedPaging)
})

test.serial('should get a document with endpoint query', async (t) => {
  const { collection, collectionName } = t.context
  await insertDocuments(collection, [
    {
      _id: '12345',
      id: 'ent1',
      type: 'entry',
      attributes: { title: 'Entry 1' },
    },
    {
      _id: '12346',
      id: 'ent2',
      type: 'entry',
      attributes: { title: 'Entry 2' },
    },
  ])
  const action = {
    type: 'GET',
    payload: {
      type: 'entry',
    },
    meta: {
      options: {
        collection: collectionName,
        db: 'test',
        query: [
          { path: 'type', op: 'eq', param: 'type' },
          { path: 'attributes.title', value: 'Entry 2' },
        ],
      },
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
  const data = response.data as TypedData[]
  t.is(data.length, 1)
  t.is(data[0].id, 'ent2')
})

test.serial(
  'should get a document by id when idIsUnique is true',
  async (t) => {
    const { collection, collectionName } = t.context
    await insertDocuments(collection, [
      {
        _id: 'ent4',
        date: new Date('2021-03-14T18:43:11Z'),
      },
      {
        _id: 'ent5',
        date: new Date('2021-03-14T18:51:09Z'),
      },
    ])
    const action = {
      type: 'GET',
      payload: {
        type: 'entry',
        id: 'ent4',
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
      authentication,
      null,
      emit,
    )
    const response = await transporter.send(action, connection)
    await transporter.disconnect(connection)

    t.truthy(response)
    t.is(response.status, 'ok', response.error)
    const data = response.data as TypedData[]
    t.is(data.length, 1)
    t.is(data[0].id, 'ent4')
    t.deepEqual(data[0].date, new Date('2021-03-14T18:43:11Z'))
  },
)

test.serial('should sort documents', async (t) => {
  const { collection, collectionName } = t.context
  await insertDocuments(collection, [
    {
      _id: '12345',
      id: 'ent1',
      type: 'entry',
      attributes: { index: 2 },
    },
    {
      _id: '12346',
      id: 'ent2',
      type: 'entry',
      attributes: { index: 3 },
    },
    {
      _id: '12347',
      id: 'ent3',
      type: 'entry',
      attributes: { index: 1 },
    },
  ])
  const action = {
    type: 'GET',
    payload: {
      type: 'entry',
    },
    meta: {
      options: {
        collection: collectionName,
        db: 'test',
        sort: {
          'attributes.index': 1,
        },
      },
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
  const data = response.data as TypedData[]
  t.is(data.length, 3)
  t.is(data[0].id, 'ent3')
  t.is(data[1].id, 'ent1')
  t.is(data[2].id, 'ent2')
})
