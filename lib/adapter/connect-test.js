import test from 'ava'
import sinon from 'sinon'

import connect from './connect'

test('should return client as connection', async (t) => {
  const sourceOptions = {
    uri: 'mongodb://db:27017/database'
  }
  const client = {}
  const mongo = { connect: sinon.stub().resolves(client) }

  const ret = await connect(mongo, sourceOptions)

  t.is(ret.status, 'ok')
  t.falsy(ret.error)
  t.is(ret.client, client)
  t.is(mongo.connect.callCount, 1)
  t.true(mongo.connect.calledWith('mongodb://db:27017/database'))
})

test('should use baseUri when uri is not supplied', async (t) => {
  const sourceOptions = {
    baseUri: 'mongodb://db:27017/database'
  }
  const client = {}
  const mongo = { connect: sinon.stub().resolves(client) }

  const ret = await connect(mongo, sourceOptions)

  t.is(ret.client, client)
  t.is(mongo.connect.callCount, 1)
  t.true(mongo.connect.calledWith('mongodb://db:27017/database'))
})

test('should return the given connection', async (t) => {
  const sourceOptions = {
    uri: 'mongodb://db:27017/database'
  }
  const client = {}
  const oldConnection = { status: 'ok', client }
  const mongo = { connect: sinon.stub().resolves(client) }

  const ret = await connect(mongo, sourceOptions, oldConnection)

  t.is(ret, oldConnection)
  t.is(mongo.connect.callCount, 0)
})

test('should return with error on missing uri', async (t) => {
  const sourceOptions = {}
  const client = {}
  const mongo = { connect: sinon.stub().resolves(client) }

  const ret = await connect(mongo, sourceOptions)

  t.is(ret.status, 'badrequest')
  t.is(ret.error, 'A uri is required when connecting to MongoDb')
  t.falsy(ret.client)
  t.is(mongo.connect.callCount, 0)
})

test('should return error when connect throws', async (t) => {
  const sourceOptions = {
    uri: 'mongodb://db:27017/database'
  }
  const mongo = { connect: () => { throw new Error('Mongo error') } }

  const ret = await connect(mongo, sourceOptions)

  t.is(ret.status, 'error')
  t.is(ret.error, 'Could not connect to MongoDb on mongodb://db:27017/database. Error: Mongo error')
  t.falsy(ret.client)
})
