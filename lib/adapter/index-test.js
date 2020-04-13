import test from 'ava'
import sinon from 'sinon'

import adapter from '.'

test('should have adapter methods', (t) => {
  t.is(typeof adapter.prepareEndpoint, 'function')
  t.is(typeof adapter.connect, 'function')
  t.is(typeof adapter.disconnect, 'function')
  t.is(typeof adapter.send, 'function')
  t.is(typeof adapter.normalize, 'function')
  t.is(typeof adapter.serialize, 'function')
})

test('prepareEndpoint should set db and collection on endpoint options', async (t) => {
  const options = { collection: 'documents' }
  const serviceOptions = { db: 'database', collection: 'override', uri: 'mongodb://db:27017/database' }
  const expected = { collection: 'documents', db: 'database' }

  const ret = await adapter.prepareEndpoint(options, serviceOptions)

  t.deepEqual(ret, expected)
})

test('prepareEndpoint should set collection on endpoint options when not set', async (t) => {
  const options = {}
  const serviceOptions = { db: 'database', collection: 'documents' }
  const expected = { collection: 'documents', db: 'database' }

  const ret = await adapter.prepareEndpoint(options, serviceOptions)

  t.deepEqual(ret, expected)
})

test('prepareEndpoint should return options when no serviceOptions', async (t) => {
  const options = { collection: 'documents' }
  const serviceOptions = null
  const expected = { collection: 'documents' }

  const ret = await adapter.prepareEndpoint(options, serviceOptions)

  t.deepEqual(ret, expected)
})

test('normalize should return data unchanged', async (t) => {
  const data = {}

  const ret = await adapter.normalize(data)

  t.is(ret, data)
})

test('serialize should return data unchanged', async (t) => {
  const data = {}

  const ret = await adapter.serialize(data)

  t.is(ret, data)
})

test('disconnect should call close on the connection', async (t) => {
  const connection = { close: sinon.stub() }

  await adapter.disconnect(connection)

  t.is(connection.close.callCount, 1)
})

test('disconnect should do nothing when no connection', async (t) => {
  const connection = null

  await t.notThrowsAsync(adapter.disconnect(connection))
})
