import test from 'ava'

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

  const ret = transporter.prepareOptions(options, 'mongodb')

  t.deepEqual(ret, expected)
})
