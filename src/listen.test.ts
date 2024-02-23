import test from 'ava'
import sinon from 'sinon'
import type { Collection, MongoClient } from 'mongodb'
import type { Connection, IncomingOptions } from './types.js'

import listen from './listen.js'

// Setup

const createConnection = (
  collection: unknown,
  incoming: IncomingOptions,
  collectionUsers: unknown = null,
  idIsUnique = false,
  emit = () => undefined,
): Connection => ({
  status: 'ok',
  mongo: {
    client: {
      db: (name: string) =>
        name === 'database'
          ? {
              collection: (name: string) =>
                name === 'documents'
                  ? (collection as Collection)
                  : name === 'users'
                    ? collectionUsers
                    : null,
            }
          : null,
    } as MongoClient,
    count: 1,
  },
  incoming,
  idIsUnique,
  emit,
})

const authenticate = async () => ({
  status: 'ok',
  access: { ident: { id: 'userFromIntegreat' } },
})

// Tests

test('should listen to the change stream and return ok', async (t) => {
  const dispatch = sinon.stub().resolves({ status: 'ok' })
  const on = sinon.stub()
  const stream = { on }
  const watch = sinon.stub().returns(stream)
  const incomingOptions = { collections: ['documents'], db: 'database' }
  const connection = createConnection({ watch }, incomingOptions)
  const expected = { status: 'ok' }

  const ret = await listen(dispatch, connection, authenticate)

  t.deepEqual(ret, expected)
  t.is(watch.callCount, 1)
  t.deepEqual(watch.args[0], [[], { fullDocument: 'updateLookup' }])
  t.is(on.callCount, 2)
  t.is(on.args[0][0], 'change')
  t.is(typeof on.args[0][1], 'function')
  t.is(dispatch.callCount, 0) // No dispatching without requests
  t.is(connection.incoming?.streams?.length, 1)
  t.is((connection.incoming?.streams as unknown[])[0], stream)
})

test('should listen to the change stream for several collections', async (t) => {
  const dispatch = sinon.stub().resolves({ status: 'ok' })
  const on = sinon.stub()
  const onUsers = sinon.stub()
  const stream = { on }
  const streamUsers = { on: onUsers }
  const watch = sinon.stub().returns(stream)
  const watchUsers = sinon.stub().returns(streamUsers)
  const incomingOptions = {
    collections: ['documents', 'users'],
    db: 'database',
  }
  const connection = createConnection({ watch }, incomingOptions, {
    watch: watchUsers,
  })
  const expected = { status: 'ok' }

  const ret = await listen(dispatch, connection, authenticate)

  t.deepEqual(ret, expected)
  t.is(watch.callCount, 1)
  t.deepEqual(watch.args[0], [[], { fullDocument: 'updateLookup' }])
  t.is(on.callCount, 2)
  t.is(on.args[0][0], 'change')
  t.is(typeof on.args[0][1], 'function')
  t.is(onUsers.callCount, 2)
  t.is(onUsers.args[0][0], 'change')
  t.is(typeof onUsers.args[0][1], 'function')
  t.is(on.args[0][1], onUsers.args[0][1])
  t.is(dispatch.callCount, 0) // No dispatching without requests
  t.is(connection.incoming?.streams?.length, 2)
  t.is((connection.incoming?.streams as unknown[])[0], stream)
  t.is((connection.incoming?.streams as unknown[])[1], streamUsers)
})

test('should dispatch action with inserted document', async (t) => {
  const dispatch = sinon.stub().resolves({ status: 'ok' })
  const on = sinon.stub()
  const watch = sinon.stub().returns({ on })
  const incomingOptions = { collections: ['documents'], db: 'database' }
  const connection = createConnection({ watch }, incomingOptions)
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
      collection: 'documents',
      db: 'database',
    },
    meta: { ident: { id: 'userFromIntegreat' } }, // Ident comes from call to `authenticate()`
  }

  const ret = await listen(dispatch, connection, authenticate)
  const handlerFn = on.args[0][1]
  await handlerFn({
    _id: { _data: '12345' },
    operationType: 'insert',
    fullDocument: data,
    ns: { db: 'database', coll: 'documents' },
  })

  t.is(ret.status, 'ok', ret.error)
  t.is(dispatch.callCount, 1)
  t.deepEqual(dispatch.args[0][0], expectedAction)
})

test('should dispatch action with updated document', async (t) => {
  const dispatch = sinon.stub().resolves({ status: 'ok' })
  const on = sinon.stub()
  const watch = sinon.stub().returns({ on })
  const incomingOptions = { collections: ['documents'], db: 'database' }
  const connection = createConnection({ watch }, incomingOptions)
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
      method: 'update',
      collection: 'documents',
      db: 'database',
    },
    meta: { ident: { id: 'userFromIntegreat' } }, // Ident comes from call to `authenticate()`
  }

  const ret = await listen(dispatch, connection, authenticate)
  const handlerFn = on.args[0][1]
  await handlerFn({
    _id: { _data: '12345' },
    operationType: 'update',
    fullDocument: data,
    ns: { db: 'database', coll: 'documents' },
  })

  t.is(ret.status, 'ok', ret.error)
  t.is(dispatch.callCount, 1)
  t.deepEqual(dispatch.args[0][0], expectedAction)
})

test('should dispatch action with inserted document when idIsUnique is true', async (t) => {
  const dispatch = sinon.stub().resolves({ status: 'ok' })
  const on = sinon.stub()
  const watch = sinon.stub().returns({ on })
  const incomingOptions = { collections: ['documents'], db: 'database' }
  const connection = createConnection(
    { watch },
    incomingOptions,
    undefined,
    true,
  )
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
      collection: 'documents',
      db: 'database',
    },
    meta: { ident: { id: 'userFromIntegreat' } }, // Ident comes from call to `authenticate()`
  }

  const ret = await listen(dispatch, connection, authenticate)
  const handlerFn = on.args[0][1]
  await handlerFn({
    _id: { _data: '12345' },
    operationType: 'insert',
    fullDocument: data,
    ns: { db: 'database', coll: 'documents' },
  })

  t.is(ret.status, 'ok', ret.error)
  t.is(dispatch.callCount, 1)
  t.deepEqual(dispatch.args[0][0], expectedAction)
})

test('should dispatch action with deleted document when idIsUnique is true', async (t) => {
  const dispatch = sinon.stub().resolves({ status: 'ok' })
  const on = sinon.stub()
  const watch = sinon.stub().returns({ on })
  const incomingOptions = { collections: ['documents'], db: 'database' }
  const connection = createConnection(
    { watch },
    incomingOptions,
    undefined,
    true,
  )
  const expectedAction = {
    type: 'DELETE',
    payload: {
      id: '12345',
      method: 'delete',
      collection: 'documents',
      db: 'database',
    },
    meta: { ident: { id: 'userFromIntegreat' } }, // Ident comes from call to `authenticate()`
  }

  const ret = await listen(dispatch, connection, authenticate)
  const handlerFn = on.args[0][1]
  await handlerFn({
    _id: { _data: 'somelongstring' },
    operationType: 'delete',
    ns: { db: 'database', coll: 'documents' },
    documentKey: { _id: '12345' },
  })

  t.is(ret.status, 'ok', ret.error)
  t.is(dispatch.callCount, 1)
  t.deepEqual(dispatch.args[0][0], expectedAction)
})

test('should not dispatch action with deleted document when idIsUnique is false', async (t) => {
  const dispatch = sinon.stub().resolves({ status: 'ok' })
  const on = sinon.stub()
  const watch = sinon.stub().returns({ on })
  const incomingOptions = { collections: ['documents'], db: 'database' }
  const connection = createConnection(
    { watch },
    incomingOptions,
    undefined,
    false,
  )

  const ret = await listen(dispatch, connection, authenticate)
  const handlerFn = on.args[0][1]
  await handlerFn({
    _id: { _data: 'somelongstring' },
    operationType: 'delete',
    ns: { db: 'database', coll: 'documents' },
    documentKey: { _id: '12345' },
  })

  t.is(ret.status, 'ok', ret.error)
  t.is(dispatch.callCount, 0) // No dispatch
})

test('should not dispatch action with replaced document', async (t) => {
  const dispatch = sinon.stub().resolves({ status: 'ok' })
  const on = sinon.stub()
  const watch = sinon.stub().returns({ on })
  const incomingOptions = { collections: ['documents'], db: 'database' }
  const connection = createConnection(
    { watch },
    incomingOptions,
    undefined,
    false,
  )

  const ret = await listen(dispatch, connection, authenticate)
  const handlerFn = on.args[0][1]
  await handlerFn({
    _id: { _data: 'somelongstring' },
    operationType: 'replace',
    ns: { db: 'database', coll: 'documents' },
    documentKey: { _id: '12345' },
  })

  t.is(ret.status, 'ok', ret.error)
  t.is(dispatch.callCount, 0) // No dispatch
})

test('should dispatch auth error', async (t) => {
  const authenticate = async () => ({
    status: 'noaccess',
    error: 'Not authorized',
    access: { ident: undefined },
  })
  const dispatch = sinon.stub().resolves({ status: 'ok' })
  const on = sinon.stub()
  const watch = sinon.stub().returns({ on })
  const incomingOptions = { collections: ['documents'], db: 'database' }
  const connection = createConnection({ watch }, incomingOptions)
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
      method: 'update',
      collection: 'documents',
      db: 'database',
    },
    response: {
      status: 'noaccess',
      error: 'Not authorized',
      access: { ident: undefined },
    },
    meta: { ident: undefined },
  }

  const ret = await listen(dispatch, connection, authenticate)
  const handlerFn = on.args[0][1]
  await handlerFn({
    _id: { _data: '12345' },
    operationType: 'update',
    fullDocument: data,
    ns: { db: 'database', coll: 'documents' },
  })

  t.is(ret.status, 'ok', ret.error)
  t.is(dispatch.callCount, 1)
  t.deepEqual(dispatch.args[0][0], expectedAction)
})

test('should listen to error events', async (t) => {
  const dispatch = sinon.stub().resolves({ status: 'ok' })
  const on = sinon.stub()
  const emitSpy = sinon.stub()
  const stream = { on }
  const watch = sinon.stub().returns(stream)
  const incomingOptions = { collections: ['documents'], db: 'database' }
  const connection = createConnection(
    { watch },
    incomingOptions,
    undefined,
    undefined,
    emitSpy,
  )
  const expected = { status: 'ok' }

  const ret = await listen(dispatch, connection, authenticate)

  t.deepEqual(ret, expected)
  t.is(on.callCount, 2)
  t.is(on.args[1][0], 'error')
  t.is(typeof on.args[1][1], 'function')
  const emitFn = on.args[1][1]
  emitFn(new Error('Oh no!'))
  t.is(emitSpy.callCount, 1)
  t.is(emitSpy.args[0][0], 'error')
  t.deepEqual(emitSpy.args[0][1], new Error('MongoDb stream error: Oh no!'))
})

test('should respond with error when no mongodb client in connection', async (t) => {
  const dispatch = sinon.stub().resolves({ status: 'ok' })
  const connection = { status: 'ok' }

  const ret = await listen(dispatch, connection, authenticate)

  t.is(ret.status, 'error', ret.error)
  t.is(ret.error, 'No MongoDB client')
  t.is(dispatch.callCount, 0)
})

test('should respond with error when no db name in connection', async (t) => {
  const dispatch = sinon.stub().resolves({ status: 'ok' })
  const incomingOptions = {
    collections: ['documents'],
    // No db
  } as IncomingOptions
  const connection = createConnection({}, incomingOptions)

  const ret = await listen(dispatch, connection, authenticate)

  t.is(ret.status, 'error', ret.error)
  t.is(ret.error, 'No MongoDB database name in incoming options')
  t.is(dispatch.callCount, 0)
})

test('should respond with error when no collection names in connection', async (t) => {
  const dispatch = sinon.stub().resolves({ status: 'ok' })
  const incomingOptions = {
    // No collections
    db: 'database',
  } as IncomingOptions
  const connection = createConnection({}, incomingOptions)

  const ret = await listen(dispatch, connection, authenticate)

  t.is(ret.status, 'error', ret.error)
  t.is(ret.error, 'No MongoDB collection name(s) in incoming options')
  t.is(dispatch.callCount, 0)
})
