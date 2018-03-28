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

test('prepareEndpoint should set db on endpoint options', async (t) => {
  const options = {collection: 'documents'}
  const sourceOptions = {db: 'database'}
  const expected = {collection: 'documents', db: 'database'}

  const ret = await adapter.prepareEndpoint(options, sourceOptions)

  t.deepEqual(ret, expected)
})

test('prepareEndpoint should return options when no sourceOptions', async (t) => {
  const options = {collection: 'documents'}
  const sourceOptions = null
  const expected = {collection: 'documents'}

  const ret = await adapter.prepareEndpoint(options, sourceOptions)

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
  const connection = {close: sinon.stub()}

  await adapter.disconnect(connection)

  t.is(connection.close.callCount, 1)
})

test('disconnect should do nothing when no connection', async (t) => {
  const connection = null

  await t.notThrows(adapter.disconnect(connection))
})
