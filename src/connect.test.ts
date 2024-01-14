import test from 'ava'
import sinon from 'sinon'
import { MongoClient } from 'mongodb'

import connect from './connect.js'

// Setup

const createMockMongo = (
  constructSpy: sinon.SinonStub,
  connectSpy: sinon.SinonStub,
  onSpy = () => undefined,
) =>
  function MongoMock(uri: string, options: Record<string, unknown>) {
    constructSpy(uri, options)
    return { connect: connectSpy, on: onSpy }
  } as unknown as typeof MongoClient

const emit = () => undefined

// Tests

test('should return connection with client', async (t) => {
  const options = {
    uri: 'mongodb://db:27027/database',
  }
  const constructSpy = sinon.stub()
  const connectSpy = sinon.stub()

  const ret = await connect(
    createMockMongo(constructSpy, connectSpy),
    options,
    emit,
  )

  t.is(ret.status, 'ok', ret.error)
  t.is(ret.mongo?.client?.connect, connectSpy)
  t.is(ret.mongo?.count, 1) // Number of connections made to this client
  t.falsy(ret.error)
  t.is(constructSpy.callCount, 1)
  t.true(constructSpy.calledWith('mongodb://db:27027/database'))
  t.is(connectSpy.callCount, 1)
  t.false(ret.idIsUnique) // Default value
})

test('should set idIsUnique on connection', async (t) => {
  const options = {
    uri: 'mongodb://db:27028/database',
    idIsUnique: true,
  }
  const constructSpy = sinon.stub()
  const connectSpy = sinon.stub()

  const ret = await connect(
    createMockMongo(constructSpy, connectSpy),
    options,
    emit,
  )

  t.is(ret.status, 'ok', ret.error)
  t.true(ret.idIsUnique)
  t.falsy(ret.error)
})

test('should use baseUri when uri is not supplied', async (t) => {
  const options = {
    baseUri: 'mongodb://db:27018/database',
  }
  const constructSpy = sinon.stub()
  const connectSpy = sinon.stub()

  await connect(createMockMongo(constructSpy, connectSpy), options, emit)

  t.is(constructSpy.callCount, 1)
  t.true(constructSpy.calledWith('mongodb://db:27018/database'))
})

test('should use supplied mongo options', async (t) => {
  const options = {
    baseUri: 'mongodb://db:27019/database',
    mongo: {
      readPreference: 'primaryPreferred',
    },
  }
  const constructSpy = sinon.stub()
  const connectSpy = sinon.stub()

  await connect(createMockMongo(constructSpy, connectSpy), options, emit)

  t.is(constructSpy.callCount, 1)
  t.deepEqual(constructSpy.args[0][1], {
    readPreference: 'primaryPreferred',
  })
})

test('should use supplied auth', async (t) => {
  const options = {
    baseUri: 'mongodb://db:27020/database',
    mongo: {
      readPreference: 'primaryPreferred',
    },
  }
  const auth = { key: 'johnf', secret: 's3cr3t' }
  const constructSpy = sinon.stub()
  const connectSpy = sinon.stub()

  await connect(createMockMongo(constructSpy, connectSpy), options, emit, auth)

  t.is(constructSpy.callCount, 1)
  t.deepEqual(constructSpy.args[0][1], {
    readPreference: 'primaryPreferred',
    auth: { username: 'johnf', password: 's3cr3t' },
  })
})

test('should pass on incoming options', async (t) => {
  const options = {
    uri: 'mongodb://db:27018/database',
    incoming: {
      collections: ['documents'],
      db: 'database',
    },
  }
  const constructSpy = sinon.stub()
  const connectSpy = sinon.stub()
  const expected = {
    collections: ['documents'],
    db: 'database',
  }

  const ret = await connect(
    createMockMongo(constructSpy, connectSpy),
    options,
    emit,
  )

  t.is(ret.status, 'ok', ret.error)
  t.deepEqual(ret.incoming, expected)
})

test('should use db from options when not set in incoming', async (t) => {
  const options = {
    uri: 'mongodb://db:27018/database',
    db: 'database',
    incoming: {
      collections: ['documents'],
      // No db
    },
  }
  const constructSpy = sinon.stub()
  const connectSpy = sinon.stub()
  const expected = {
    collections: ['documents'],
    db: 'database',
  }

  const ret = await connect(
    createMockMongo(constructSpy, connectSpy),
    options,
    emit,
  )

  t.is(ret.status, 'ok', ret.error)
  t.deepEqual(ret.incoming, expected)
})

test('should reuse client when connecting twice with same options', async (t) => {
  const options = {
    uri: 'mongodb://db:27021/database',
  }
  const constructSpy = sinon.stub()
  const connectSpy = sinon.stub()

  const ret1 = await connect(
    createMockMongo(constructSpy, connectSpy),
    options,
    emit,
  )
  const ret2 = await connect(
    createMockMongo(constructSpy, connectSpy),
    options,
    emit,
  )

  t.is(ret1.status, 'ok', ret1.error)
  t.is(ret2.status, 'ok', ret2.error)
  t.is(ret1.mongo?.client?.connect, connectSpy)
  t.is(ret1.mongo?.client, ret2.mongo?.client)
  t.is(ret1.mongo?.count, 2)
  t.is(ret2.mongo?.count, 2)
  t.is(constructSpy.callCount, 1)
  t.true(constructSpy.calledWith('mongodb://db:27021/database'))
  t.is(connectSpy.callCount, 1)
})

test('should create new client after disconnect', async (t) => {
  const options = {
    uri: 'mongodb://db:27029/database',
  }
  const constructSpy = sinon.stub()
  const connectSpy = sinon.stub()

  const ret1 = await connect(
    createMockMongo(constructSpy, connectSpy),
    options,
    emit,
  )
  ret1.mongo!.count = 0 // Mimicks disconnect
  ret1.mongo!.client = null // Mimicks disconnect
  const ret2 = await connect(
    createMockMongo(constructSpy, connectSpy),
    options,
    emit,
  )

  t.is(ret1.status, 'ok', ret1.error)
  t.is(ret2.status, 'ok', ret2.error)
  t.is(ret1.mongo?.count, 1)
  t.is(ret2.mongo?.count, 1)
  // t.not(ret1.mongo?.client, ret2.mongo?.client) // This don't work, as client is the same due to mocking
  t.is(constructSpy.callCount, 2)
  t.is(connectSpy.callCount, 2)
})

test('should create new client for different options', async (t) => {
  const options1 = {
    uri: 'mongodb://db:27022/database',
  }
  const options2 = {
    uri: 'mongodb://db:27022/database2',
  }
  const constructSpy = sinon.stub()
  const connectSpy = sinon.stub()

  const ret1 = await connect(
    createMockMongo(constructSpy, connectSpy),
    options1,
    emit,
  )
  const ret2 = await connect(
    createMockMongo(constructSpy, connectSpy),
    options2,
    emit,
  )

  t.is(ret1.status, 'ok', ret1.error)
  t.is(ret2.status, 'ok', ret2.error)
  t.not(ret1.mongo?.client, ret2.mongo?.client)
  t.is(constructSpy.callCount, 2)
  t.is(connectSpy.callCount, 2)
})

test('should create new client for different auths', async (t) => {
  const options = {
    uri: 'mongodb://db:27023/database',
  }
  const auth1 = { key: 'johnf', secret: 's3cr3t' }
  const auth2 = { key: 'johnf', secret: 'wr0ng' }
  const constructSpy = sinon.stub()
  const connectSpy = sinon.stub()

  const ret1 = await connect(
    createMockMongo(constructSpy, connectSpy),
    options,
    emit,
    auth1,
  )
  const ret2 = await connect(
    createMockMongo(constructSpy, connectSpy),
    options,
    emit,
    auth2,
  )

  t.is(ret1.status, 'ok', ret1.error)
  t.is(ret2.status, 'ok', ret2.error)
  t.not(ret1.mongo?.client, ret2.mongo?.client)
  t.is(constructSpy.callCount, 2)
  t.is(connectSpy.callCount, 2)
})

test('should return the given connection', async (t) => {
  const options = {
    uri: 'mongodb://db:27024/database',
  }
  const client = {} as MongoClient
  const oldConnection = { status: 'ok', client }
  const constructSpy = sinon.stub()
  const connectSpy = sinon.stub()

  const ret = await connect(
    createMockMongo(constructSpy, connectSpy),
    options,
    emit,
    null,
    oldConnection,
  )

  t.is(ret, oldConnection)
  t.is(connectSpy.callCount, 0)
})

test('should listen to error events', async (t) => {
  const options = {
    uri: 'mongodb://db:27025/database',
  }
  const constructSpy = sinon.stub()
  const connectSpy = sinon.stub()
  const onSpy = sinon.stub()
  const emitSpy = sinon.stub()

  const ret = await connect(
    createMockMongo(constructSpy, connectSpy, onSpy),
    options,
    emitSpy,
  )

  t.is(ret.status, 'ok', ret.error)
  t.true(onSpy.callCount >= 1)
  t.is(onSpy.args[0][0], 'error')
  const emitFn = onSpy.args[0][1]
  emitFn(new Error('Oh no!'))
  t.is(emitSpy.callCount, 1)
  t.is(emitSpy.args[0][0], 'error')
  t.deepEqual(emitSpy.args[0][1], new Error('MongoDb error: Oh no!'))
})

test('should return with error on missing uri', async (t) => {
  const options = {}
  const constructSpy = sinon.stub()
  const connectSpy = sinon.stub()

  const ret = await connect(
    createMockMongo(constructSpy, connectSpy),
    options,
    emit,
  )

  t.is(ret.status, 'badrequest')
  t.is(ret.error, 'A uri is required when connecting to MongoDb')
  t.falsy(ret.mongo?.client)
  t.is(connectSpy.callCount, 0)
})

test('should return error when connect throws', async (t) => {
  const options = {
    uri: 'mongodb://db:27026/database',
  }
  const constructSpy = sinon.stub()
  const connectSpy = sinon.stub().rejects(new Error('Mongo error'))

  const ret = await connect(
    createMockMongo(constructSpy, connectSpy),
    options,
    emit,
  )

  t.is(ret.status, 'error')
  t.is(
    ret.error,
    'Could not connect to MongoDb on mongodb://db:27026/database. Error: Mongo error',
  )
  t.falsy(ret.mongo?.client)
})
