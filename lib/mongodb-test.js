import test from 'ava'
import sinon from 'sinon'

import mongodb from './mongodb'

test('should have adapter methods', (t) => {
  t.is(typeof mongodb.prepareEndpoint, 'function')
  t.is(typeof mongodb.connect, 'function')
  t.is(typeof mongodb.disconnect, 'function')
  t.is(typeof mongodb.send, 'function')
  t.is(typeof mongodb.normalize, 'function')
  t.is(typeof mongodb.serialize, 'function')
})

test('prepareEndpoint should set db on endpoint options', async (t) => {
  const options = {collection: 'documents'}
  const sourceOptions = {db: 'database'}
  const expected = {collection: 'documents', db: 'database'}

  const ret = await mongodb.prepareEndpoint(options, sourceOptions)

  t.deepEqual(ret, expected)
})

test('prepareEndpoint should return options when no sourceOptions', async (t) => {
  const options = {collection: 'documents'}
  const sourceOptions = null
  const expected = {collection: 'documents'}

  const ret = await mongodb.prepareEndpoint(options, sourceOptions)

  t.deepEqual(ret, expected)
})

test('normalize should return data unchanged', async (t) => {
  const data = {}

  const ret = await mongodb.normalize(data)

  t.is(ret, data)
})

test('serialize should return data unchanged', async (t) => {
  const data = {}

  const ret = await mongodb.serialize(data)

  t.is(ret, data)
})

test('disconnect should call close on the connection', async (t) => {
  const connection = {close: sinon.stub()}

  await mongodb.disconnect(connection)

  t.is(connection.close.callCount, 1)
})

test('disconnect should do nothing when no connection', async (t) => {
  const connection = null

  await t.notThrows(mongodb.disconnect(connection))
})
