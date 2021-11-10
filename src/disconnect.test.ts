import test from 'ava'
import sinon = require('sinon')
import { MongoClient } from 'mongodb'

import disconnect from './disconnect'

// Setup

// Tests

test('should disconnect client', async (t) => {
  const closeSpy = sinon.stub().resolves(undefined)
  const client = { close: closeSpy } as unknown as MongoClient
  const connection = { status: 'ok', client }

  await disconnect(connection)

  t.is(closeSpy.callCount, 1)
})

test('should do nothing when no client', async (t) => {
  const conn = { status: 'ok', client: undefined }

  await t.notThrowsAsync(disconnect(conn))
})

test('should do nothing when connection has an error', async (t) => {
  const closeSpy = sinon.stub().resolves(undefined)
  const client = { close: closeSpy } as unknown as MongoClient
  const connection = { status: 'error', error: 'Whaaat?', client }

  await disconnect(connection)

  t.is(closeSpy.callCount, 0)
})

test('should do nothing when no connection', async (t) => {
  const conn = null

  await t.notThrowsAsync(disconnect(conn))
})
