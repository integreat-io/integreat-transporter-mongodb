import test from 'ava'
import sinon from 'sinon'

import connect from './connect'

test('should return client as connection', async (t) => {
  const sourceOptions = {
    baseUri: 'mongodb://db:27017/database'
  }
  const client = {}
  const mongo = { connect: sinon.stub().resolves(client) }

  const ret = await connect(mongo, { sourceOptions })

  t.is(ret, client)
  t.is(mongo.connect.callCount, 1)
  t.true(mongo.connect.calledWith('mongodb://db:27017/database'))
})

test('should return the given connection', async (t) => {
  const sourceOptions = {
    baseUri: 'mongodb://db:27017/database'
  }
  const oldConnection = {}
  const client = {}
  const mongo = { connect: sinon.stub().resolves(client) }

  const ret = await connect(mongo, { sourceOptions }, oldConnection)

  t.is(ret, oldConnection)
  t.is(mongo.connect.callCount, 0)
})

test('should throw on missing baseUri', async (t) => {
  const sourceOptions = {}
  const client = {}
  const mongo = { connect: sinon.stub().resolves(client) }

  const error = await t.throwsAsync(connect(mongo, { sourceOptions }))

  t.true(error instanceof TypeError)
  t.is(mongo.connect.callCount, 0)
})

test('should throw when connect throws', async (t) => {
  const sourceOptions = {
    baseUri: 'mongodb://db:27017/database'
  }
  const mongo = { connect: () => { throw new Error('Mongo error') } }

  const error = await t.throwsAsync(connect(mongo, { sourceOptions }))

  t.true(error instanceof Error)
  t.is(error.message, 'Could not connect to MongoDb on mongodb://db:27017/database. Error: Mongo error')
})
