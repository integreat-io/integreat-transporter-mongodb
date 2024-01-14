import test from 'ava'
import sinon from 'sinon'
import { MongoClient, ChangeStream } from 'mongodb'
import { MongoClientObject } from './types.js'

import disconnect from './disconnect.js'

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

test('should close streams', async (t) => {
  const closeSpy = sinon.stub().resolves(undefined)
  const closeStreamSpy0 = sinon.stub().resolves(undefined)
  const closeStreamSpy1 = sinon.stub().resolves(undefined)
  const stream0 = { close: closeStreamSpy0 } as unknown as ChangeStream
  const stream1 = { close: closeStreamSpy1 } as unknown as ChangeStream
  const client = { close: closeSpy } as unknown as MongoClient
  const clientObject: MongoClientObject = { client, count: 1 }
  const connection = {
    status: 'ok',
    mongo: clientObject,
    incoming: {
      streams: [stream0, stream1],
    },
  }

  await disconnect(connection)

  t.is(closeStreamSpy0.callCount, 1)
  t.is(closeStreamSpy1.callCount, 1)
  t.deepEqual(connection.incoming?.streams, [])
  t.is(closeSpy.callCount, 1)
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
