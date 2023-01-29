import test from 'ava'
import { uri } from './helpers/mongo.js'

import transporter from '../index.js'

// Helpers

const sourceOptions = { uri }
const auth = {}
const emit = () => undefined

// Tests

test('should return the provided connection', async (t) => {
  const conn1 = await transporter.connect(sourceOptions, auth, null, emit)
  const conn2 = await transporter.connect(sourceOptions, auth, conn1, emit)

  t.is(conn1, conn2)

  await transporter.disconnect(conn1)
})
