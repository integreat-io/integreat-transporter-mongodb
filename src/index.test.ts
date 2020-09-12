import test from 'ava'
import sinon = require('sinon')

import transporter from '.'

// Tests

test('should have transporter methods', (t) => {
  t.is(typeof transporter.prepareOptions, 'function')
  t.is(typeof transporter.connect, 'function')
  t.is(typeof transporter.disconnect, 'function')
  t.is(typeof transporter.send, 'function')
})

// Tests -- prepareOptions

test('prepareOptions should set options', async (t) => {
  const options = {
    db: 'database',
    collection: 'documents',
    uri: 'mongodb://db:27017/database',
  }
  const expected = options

  const ret = transporter.prepareOptions(options)

  t.deepEqual(ret, expected)
})

// Tests -- disconnect

test('disconnect should call close on the connection', async (t) => {
  const close = sinon.stub()
  const connection = { status: 'ok', client: { close } }

  await transporter.disconnect(connection)

  t.is(close.callCount, 1)
})

test('disconnect should do nothing when no valid connection', async (t) => {
  const connection = { status: 'error' }

  await t.notThrowsAsync(transporter.disconnect(connection))
})

test('disconnect should do nothing when no connection object', async (t) => {
  const connection = null

  await t.notThrowsAsync(transporter.disconnect(connection))
})
