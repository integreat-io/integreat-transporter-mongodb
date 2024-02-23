import test from 'ava'

import transporter from './index.js'

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
    uri: 'mongodb://db:27030/database',
  }
  const expected = options

  const ret = transporter.prepareOptions(options, 'mongodb')

  t.deepEqual(ret, expected)
})

// Tests -- shouldListen

test('should return true when incoming is set in options', (t) => {
  const options = {
    uri: 'mongodb://db:27030/database',
    db: 'database',
    collection: 'documents',
    incoming: {
      collections: ['documents'],
    },
  }

  const ret = transporter.shouldListen!(options)

  t.true(ret)
})

test('should return false when incoming is not set in options', (t) => {
  const options = {
    uri: 'mongodb://db:27030/database',
    db: 'database',
    collection: 'documents',
  }

  const ret = transporter.shouldListen!(options)

  t.false(ret)
})
