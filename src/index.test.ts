import test from 'ava'
import sinon = require('sinon')

import adapter from '.'

// Tests

test('should have adapter methods', (t) => {
  t.is(typeof adapter.prepareOptions, 'function')
  t.is(typeof adapter.connect, 'function')
  t.is(typeof adapter.disconnect, 'function')
  t.is(typeof adapter.send, 'function')
})

// Tests -- prepareOptions

test('prepareOptions should set options', async (t) => {
  const options = {
    db: 'database',
    collection: 'documents',
    uri: 'mongodb://db:27017/database',
  }
  const expected = options

  const ret = adapter.prepareOptions(options)

  t.deepEqual(ret, expected)
})

// Tests -- disconnect

test('disconnect should call close on the connection', async (t) => {
  const close = sinon.stub()
  const connection = { status: 'ok', client: { close } }

  await adapter.disconnect(connection)

  t.is(close.callCount, 1)
})

test('disconnect should do nothing when no valid connection', async (t) => {
  const connection = { status: 'error' }

  await t.notThrowsAsync(adapter.disconnect(connection))
})

test('disconnect should do nothing when no connection object', async (t) => {
  const connection = null

  await t.notThrowsAsync(adapter.disconnect(connection))
})
