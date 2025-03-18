import ava, { TestFn } from 'ava'
import sinon from 'sinon'
import {
  uri,
  openMongoWithCollection,
  closeMongo,
  insertDocument,
  deleteDocuments,
  MongoElements,
} from './helpers/mongo.js'

import transporter from '../index.js'

const test = ava as TestFn<MongoElements>

// Helpers

const options = { uri }
const authorization = null
const emit = () => undefined
const authenticate = async () => ({
  status: 'ok',
  access: { ident: { id: 'userFromIntegreat' } },
})

test.beforeEach(async (t) => {
  t.context = await openMongoWithCollection('test')
})

test.afterEach.always(async (t) => {
  const { client, collection } = t.context
  await deleteDocuments(collection, {})
  closeMongo(client)
})

// Tests

test.serial('should listen and recieve new document', async (t) => {
  const { collection, collectionName } = t.context
  const dispatch = sinon.stub().resolves({ status: 'ok' })
  const optionsWithIncoming = {
    ...options,
    incoming: {
      collections: [collectionName],
      db: 'test',
    },
  }
  const data = {
    _id: '1234100',
    id: 'ent100',
    title: 'Entry 100!',
    date: new Date('2021-03-14T18:43:11Z'),
  }
  const expectedAction = {
    type: 'SET',
    payload: {
      data: data,
      method: 'insert',
      collection: collectionName,
      db: 'test',
    },
    meta: { ident: { id: 'userFromIntegreat' } },
  }

  const connection = await transporter.connect(
    optionsWithIncoming,
    authorization,
    null,
    emit,
  )
  const ret = await transporter.listen!(
    dispatch,
    connection,
    authenticate,
    emit,
  )
  // Wait for 500 ms to be sure we're listening
  await new Promise((resolve) => setTimeout(resolve, 500, undefined))
  await insertDocument(collection, data)
  // Wait for 500 ms to be sure dispatch has happened
  await new Promise((resolve) => setTimeout(resolve, 500, undefined))

  t.is(ret.status, 'ok', ret.error)
  t.is(dispatch.callCount, 1)
  t.deepEqual(dispatch.args[0][0], expectedAction)

  await transporter.disconnect(connection)
})

test.serial('should listen and recieve updated document', async (t) => {
  const { collection, collectionName } = t.context
  const dispatch = sinon.stub().resolves({ status: 'ok' })
  const optionsWithIncoming = {
    ...options,
    incoming: {
      collections: [collectionName],
      db: 'test',
    },
  }
  const data = {
    _id: '1234101',
    id: 'ent101',
    title: 'Entry 101!',
    date: new Date('2021-03-14T18:43:11Z'),
  }
  const expectedAction = {
    type: 'SET',
    payload: {
      data: {
        ...data,
        title: 'Updated!',
      },
      method: 'update',
      collection: collectionName,
      db: 'test',
    },
    meta: { ident: { id: 'userFromIntegreat' } },
  }
  await insertDocument(collection, data) // Insert document that we will update

  const connection = await transporter.connect(
    optionsWithIncoming,
    authorization,
    null,
    emit,
  )
  const ret = await transporter.listen!(
    dispatch,
    connection,
    authenticate,
    emit,
  )
  // Wait for 500 ms to be sure we're listening
  await new Promise((resolve) => setTimeout(resolve, 500, undefined))
  await collection.updateOne({ id: 'ent101' }, [
    { $set: { title: 'Updated!' } },
  ])
  // Wait for 500 ms to be sure dispatch has happened
  await new Promise((resolve) => setTimeout(resolve, 500, undefined))

  t.is(ret.status, 'ok', ret.error)
  t.is(dispatch.callCount, 1)
  t.deepEqual(dispatch.args[0][0], expectedAction)

  await transporter.disconnect(connection)
})

test.serial(
  'should listen and recieve new document with idIsUnique',
  async (t) => {
    const { collection, collectionName } = t.context
    const dispatch = sinon.stub().resolves({ status: 'ok' })
    const optionsWithIncomingAndIdIsUnique = {
      ...options,
      incoming: {
        collections: [collectionName],
        db: 'test',
        idIsUnique: true,
      },
    }
    const data = {
      _id: 'ent100',
      title: 'Entry 100!',
      date: new Date('2021-03-14T18:43:11Z'),
    }
    const expectedData = {
      id: 'ent100',
      title: 'Entry 100!',
      date: new Date('2021-03-14T18:43:11Z'),
    }
    const expectedAction = {
      type: 'SET',
      payload: {
        data: expectedData,
        method: 'insert',
        collection: collectionName,
        db: 'test',
      },
      meta: { ident: { id: 'userFromIntegreat' } },
    }

    const connection = await transporter.connect(
      optionsWithIncomingAndIdIsUnique,
      authorization,
      null,
      emit,
    )
    const ret = await transporter.listen!(
      dispatch,
      connection,
      authenticate,
      emit,
    )
    // Wait for 500 ms to be sure we're listening
    await new Promise((resolve) => setTimeout(resolve, 500, undefined))
    await insertDocument(collection, data)
    // Wait for 500 ms to be sure dispatch has happened
    await new Promise((resolve) => setTimeout(resolve, 500, undefined))

    t.is(ret.status, 'ok', ret.error)
    t.is(dispatch.callCount, 1)
    t.deepEqual(dispatch.args[0][0], expectedAction)

    await transporter.disconnect(connection)
  },
)
