import test from 'ava'
import sinon = require('sinon')
import { MongoClient } from 'mongodb'

import connect from './connect'

// Tests

test('should return client as connection', async (t) => {
  const options = {
    uri: 'mongodb://db:27017/database',
  }
  const client = {} as MongoClient
  const mongo = ({
    connect: async () => client,
  } as unknown) as typeof MongoClient
  const connectSpy = sinon.spy(mongo, 'connect')

  const ret = await connect(mongo, options)

  t.is(ret.status, 'ok')
  t.falsy(ret.error)
  t.is(ret.client, client)
  t.is(connectSpy.callCount, 1)
  t.true(connectSpy.calledWith('mongodb://db:27017/database'))
})

test('should use baseUri when uri is not supplied', async (t) => {
  const options = {
    baseUri: 'mongodb://db:27017/database',
  }
  const client = {} as MongoClient
  const mongo = ({
    connect: async () => client,
  } as unknown) as typeof MongoClient
  const connectSpy = sinon.spy(mongo, 'connect')

  const ret = await connect(mongo, options)

  t.is(ret.client, client)
  t.is(connectSpy.callCount, 1)
  t.true(connectSpy.calledWith('mongodb://db:27017/database'))
})

test('should return the given connection', async (t) => {
  const options = {
    uri: 'mongodb://db:27017/database',
  }
  const client = {} as MongoClient
  const oldConnection = { status: 'ok', client }
  const mongo = ({
    connect: async () => client,
  } as unknown) as typeof MongoClient
  const connectSpy = sinon.spy(mongo, 'connect')

  const ret = await connect(mongo, options, oldConnection)

  t.is(ret, oldConnection)
  t.is(connectSpy.callCount, 0)
})

test('should return with error on missing uri', async (t) => {
  const options = {}
  const client = {} as MongoClient
  const mongo = ({
    connect: async () => client,
  } as unknown) as typeof MongoClient
  const connectSpy = sinon.spy(mongo, 'connect')

  const ret = await connect(mongo, options)

  t.is(ret.status, 'badrequest')
  t.is(ret.error, 'A uri is required when connecting to MongoDb')
  t.falsy(ret.client)
  t.is(connectSpy.callCount, 0)
})

test('should return error when connect throws', async (t) => {
  const options = {
    uri: 'mongodb://db:27017/database',
  }
  const mongo = ({
    connect: async () => {
      throw new Error('Mongo error')
    },
  } as unknown) as typeof MongoClient

  const ret = await connect(mongo, options)

  t.is(ret.status, 'error')
  t.is(
    ret.error,
    'Could not connect to MongoDb on mongodb://db:27017/database. Error: Mongo error'
  )
  t.falsy(ret.client)
})
