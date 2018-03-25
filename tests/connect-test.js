import test from 'ava'
import {dbUri} from './helpers/mongo'

import adapter from '..'

// Helpers

const sourceOptions = {dbUri}

// Tests

test('should return the provided connection', async (t) => {
  const conn1 = await adapter.connect({sourceOptions}, null)
  const conn2 = await adapter.connect({sourceOptions}, conn1)

  t.is(conn1, conn2)

  await adapter.disconnect(conn1)
})
