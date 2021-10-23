import test from 'ava'
import sinon = require('sinon')
import { MongoClient } from 'mongodb'

import connect from './connect'

// Setup

const createMockMongo = (
  constructSpy: sinon.SinonStub,
  connectSpy: sinon.SinonStub
) =>
  function MongoMock(uri: string, options: Record<string, unknown>) {
    constructSpy(uri, options)
    return { connect: connectSpy }
  } as unknown as typeof MongoClient

// Tests

test('should return client as connection', async (t) => {
  const options = {
    uri: 'mongodb://db:27017/database',
  }
  const constructSpy = sinon.stub()
  const connectSpy = sinon.stub()

  const ret = await connect(createMockMongo(constructSpy, connectSpy), options)

  t.is(ret.status, 'ok', ret.error)
  t.is(ret.client?.connect, connectSpy)
  t.falsy(ret.error)
  t.is(constructSpy.callCount, 1)
  t.true(constructSpy.calledWith('mongodb://db:27017/database'))
  t.is(connectSpy.callCount, 1)
})

test('should use baseUri when uri is not supplied', async (t) => {
  const options = {
    baseUri: 'mongodb://db:27017/database',
  }
  const constructSpy = sinon.stub()
  const connectSpy = sinon.stub()

  await connect(createMockMongo(constructSpy, connectSpy), options)

  t.is(constructSpy.callCount, 1)
  t.true(constructSpy.calledWith('mongodb://db:27017/database'))
})

test('should use supplied mongo options', async (t) => {
  const options = {
    baseUri: 'mongodb://db:27017/database',
    mongo: {
      readPreference: 'primaryPreferred',
    },
  }
  const constructSpy = sinon.stub()
  const connectSpy = sinon.stub()

  await connect(createMockMongo(constructSpy, connectSpy), options)

  t.is(constructSpy.callCount, 1)
  t.deepEqual(constructSpy.args[0][1], {
    readPreference: 'primaryPreferred',
  })
})

test('should return the given connection', async (t) => {
  const options = {
    uri: 'mongodb://db:27017/database',
  }
  const client = {} as MongoClient
  const oldConnection = { status: 'ok', client }
  const constructSpy = sinon.stub()
  const connectSpy = sinon.stub()

  const ret = await connect(
    createMockMongo(constructSpy, connectSpy),
    options,
    oldConnection
  )

  t.is(ret, oldConnection)
  t.is(connectSpy.callCount, 0)
})

test('should return with error on missing uri', async (t) => {
  const options = {}
  const constructSpy = sinon.stub()
  const connectSpy = sinon.stub()

  const ret = await connect(createMockMongo(constructSpy, connectSpy), options)

  t.is(ret.status, 'badrequest')
  t.is(ret.error, 'A uri is required when connecting to MongoDb')
  t.falsy(ret.client)
  t.is(connectSpy.callCount, 0)
})

test('should return error when connect throws', async (t) => {
  const options = {
    uri: 'mongodb://db:27017/database',
  }
  const constructSpy = sinon.stub()
  const connectSpy = sinon.stub().rejects(new Error('Mongo error'))

  const ret = await connect(createMockMongo(constructSpy, connectSpy), options)

  t.is(ret.status, 'error')
  t.is(
    ret.error,
    'Could not connect to MongoDb on mongodb://db:27017/database. Error: Mongo error'
  )
  t.falsy(ret.client)
})
