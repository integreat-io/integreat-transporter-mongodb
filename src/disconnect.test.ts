import test from 'ava'
import sinon = require('sinon')
import { MongoClient } from 'mongodb'
import { MongoClientObject } from './types'

import disconnect from './disconnect'

// Setup

// Tests

test('should disconnect client', async (t) => {
  const closeSpy = sinon.stub().resolves(undefined)
  const client = { close: closeSpy } as unknown as MongoClient
  const clientObject: MongoClientObject = { client, count: 1 }
  const connection = { status: 'ok', mongo: clientObject }

  await disconnect(connection)

  t.is(closeSpy.callCount, 1)
  t.is(clientObject.count, 0)
  t.is(clientObject.client, null)
})

test('should not disconnect client when the count is higher than 1', async (t) => {
  const closeSpy = sinon.stub().resolves(undefined)
  const client = { close: closeSpy } as unknown as MongoClient
  const clientObject = { client, count: 2 }
  const connection = { status: 'ok', mongo: clientObject }

  await disconnect(connection)

  t.is(closeSpy.callCount, 0)
  t.is(clientObject.count, 1)
})

test('should do nothing when no client', async (t) => {
  const conn = { status: 'ok', client: undefined }

  await t.notThrowsAsync(disconnect(conn))
})

test('should do nothing when connection has an error', async (t) => {
  const closeSpy = sinon.stub().resolves(undefined)
  const client = { close: closeSpy } as unknown as MongoClient
  const connection = {
    status: 'error',
    error: 'Whaaat?',
    mongo: { client, count: 1 },
  }

  await disconnect(connection)

  t.is(closeSpy.callCount, 0)
})

test('should do nothing when no connection', async (t) => {
  const conn = null

  await t.notThrowsAsync(disconnect(conn))
})
