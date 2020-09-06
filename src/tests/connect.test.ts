import test from 'ava'
import { uri } from './helpers/mongo'

import adapter from '..'

// Helpers

const sourceOptions = { uri }
const auth = {}

// Tests

test('should return the provided connection', async (t) => {
  const conn1 = await adapter.connect(sourceOptions, auth, null)
  const conn2 = await adapter.connect(sourceOptions, auth, conn1)

  t.is(conn1, conn2)

  await adapter.disconnect(conn1)
})
