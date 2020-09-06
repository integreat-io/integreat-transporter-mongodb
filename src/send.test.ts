import test from 'ava'
import sinon = require('sinon')
import { TypedData } from 'integreat'
import { Collection, MongoClient } from 'mongodb'

import send from './send'

// Helpers

const createConnection = (collection: unknown) => ({
  status: 'ok',
  client: {
    db: (name: string) =>
      name === 'database'
        ? {
            collection: (name: string) =>
              name === 'documents' ? (collection as Collection) : null,
          }
        : null,
  } as MongoClient,
})

const createFind = (items: TypedData[]) => {
  const docs = items.map((item) => ({
    ...item,
    _id: `${item.$type}:${item.id}`,
  }))
  const it = docs[Symbol.iterator]()

  return sinon.stub().resolves({
    // toArray returns all docs
    toArray: async () => docs,
    // Mimick limit method
    limit: (size: number) => ({ toArray: async () => docs.slice(0, size) }),
    // Mimick next()
    next: async () => it.next().value,
  })
}

const defaultExchange = {
  status: null,
  request: {},
  response: {},
  meta: {},
}

// Tests

test('should get items', async (t) => {
  const find = createFind([
    { id: 'ent1', $type: 'entry' },
    { id: 'ent2', $type: 'entry' },
  ])
  const connection = createConnection({ find })
  const exchange = {
    ...defaultExchange,
    type: 'GET',
    request: {
      type: 'entry',
      params: {
        typePlural: 'entries',
      },
    },
    options: {
      collection: 'documents',
      db: 'database',
    },
  }

  const { status, response } = await send(exchange, connection)

  t.is(status, 'ok')
  const data = response.data as TypedData[]
  t.is(data.length, 2)
  t.is(data[0].id, 'ent1')
  t.is(data[1].id, 'ent2')
  t.true(find.calledWith({ type: 'entry' }))
})

test('should update one item', async (t) => {
  const updateOne = sinon.stub().returns({
    matchedCount: 1,
    modifiedCount: 1,
    upsertedCount: 0,
  })
  const connection = createConnection({ updateOne })
  const data = { id: 'ent1', $type: 'entry', title: 'Entry 1' }
  const exchange = {
    ...defaultExchange,
    type: 'SET',
    request: { data },
    options: {
      collection: 'documents',
      db: 'database',
    },
  }
  const expectedData = [{ id: 'ent1', $type: 'entry', status: 'ok' }]
  const _id = 'entry:ent1'

  const { status, response } = await send(exchange, connection)

  t.is(status, 'ok')
  t.deepEqual(response.data, expectedData)
  t.is(updateOne.callCount, 1)
  t.deepEqual(updateOne.args[0][0], { _id: 'entry:ent1' })
  t.deepEqual(updateOne.args[0][1], { $set: { ...data, _id } })
  t.true(
    updateOne.calledWith({ _id: 'entry:ent1' }, { $set: { ...data, _id } })
  )
})

test('should return error when data cannot be updated', async (t) => {
  const updateOne = sinon.stub().throws(new Error('Mongo error'))
  const connection = createConnection({ updateOne })
  const data = { id: 'ent1', $type: 'entry', title: 'Entry 1' }
  const exchange = {
    ...defaultExchange,
    type: 'SET',
    request: { data },
    options: {
      collection: 'documents',
      db: 'database',
    },
  }
  const expectedResponse = {
    error: 'Error updating item(s) in mongodb',
    data: [
      { id: 'ent1', $type: 'entry', status: 'error', error: 'Mongo error' },
    ],
  }

  const { status, response } = await send(exchange, connection)

  t.is(status, 'error')
  t.deepEqual(response, expectedResponse)
})

test('should update items', async (t) => {
  const updateOne = sinon.stub().returns({
    matchedCount: 1,
    modifiedCount: 1,
    upsertedCount: 0,
  })
  const connection = createConnection({ updateOne })
  const data = [
    { id: 'ent1', $type: 'entry', title: 'Entry 1' },
    { id: 'ent2', $type: 'entry', title: 'Entry 2' },
  ]
  const exchange = {
    ...defaultExchange,
    type: 'SET',
    request: { data },
    options: {
      collection: 'documents',
      db: 'database',
    },
  }
  const expectedData = [
    { id: 'ent1', $type: 'entry', status: 'ok' },
    { id: 'ent2', $type: 'entry', status: 'ok' },
  ]

  const { status, response } = await send(exchange, connection)

  t.is(status, 'ok')
  t.deepEqual(response.data, expectedData)
  t.is(updateOne.callCount, 2)
  t.true(
    updateOne.calledWith(
      { _id: 'entry:ent1' },
      { $set: { ...data[0], _id: 'entry:ent1' } }
    )
  )
  t.true(
    updateOne.calledWith(
      { _id: 'entry:ent2' },
      { $set: { ...data[1], _id: 'entry:ent2' } }
    )
  )
})

test('should return error when one of the items cannot be updated', async (t) => {
  const updateOne = sinon.stub()
  updateOne.onFirstCall().returns({
    matchedCount: 1,
    modifiedCount: 1,
    upsertedCount: 0,
  })
  updateOne.onSecondCall().throws(new Error('Mongo error'))
  const connection = createConnection({ updateOne })
  const data = [
    { id: 'ent1', $type: 'entry', title: 'Entry 1' },
    { id: 'ent2', $type: 'entry', title: 'Entry 2' },
  ]
  const exchange = {
    ...defaultExchange,
    type: 'SET',
    request: { data },
    options: {
      collection: 'documents',
      db: 'database',
    },
  }
  const expectedData = [
    { id: 'ent1', $type: 'entry', status: 'ok' },
    { id: 'ent2', $type: 'entry', status: 'error', error: 'Mongo error' },
  ]

  const { status, response } = await send(exchange, connection)

  t.is(status, 'error')
  t.deepEqual(response.data, expectedData)
  t.is(updateOne.callCount, 2)
  t.true(
    updateOne.calledWith(
      { _id: 'entry:ent1' },
      { $set: { ...data[0], _id: 'entry:ent1' } }
    )
  )
  t.true(
    updateOne.calledWith(
      { _id: 'entry:ent2' },
      { $set: { ...data[1], _id: 'entry:ent2' } }
    )
  )
})

test('should insert one item', async (t) => {
  const updateOne = sinon.stub().returns({
    matchedCount: 0,
    modifiedCount: 0,
    upsertedCount: 1,
  })
  const connection = createConnection({ updateOne })
  const data = { id: 'ent3', $type: 'entry', title: 'Entry 3' }
  const exchange = {
    ...defaultExchange,
    type: 'SET',
    request: { data },
    options: {
      collection: 'documents',
      db: 'database',
    },
  }
  const expectedData = [{ id: 'ent3', $type: 'entry', status: 'ok' }]
  const _id = 'entry:ent3'

  const { status, response } = await send(exchange, connection)

  t.is(status, 'ok')
  t.deepEqual(response.data, expectedData)
  t.is(updateOne.callCount, 1)
  t.true(
    updateOne.calledWith(
      { _id: 'entry:ent3' },
      { $set: { ...data, _id } },
      { upsert: true }
    )
  )
})

test('should return noaction when no item', async (t) => {
  const updateOne = sinon.stub().returns({
    matchedCount: 1,
    modifiedCount: 1,
    upsertedCount: 0,
  })
  const connection = createConnection({ updateOne })
  const exchange = {
    ...defaultExchange,
    type: 'SET',
    requtest: { data: undefined },
    options: {
      collection: 'documents',
      db: 'database',
    },
  }

  const { status, response } = await send(exchange, connection)

  t.is(status, 'noaction')
  t.is(response.error, 'No items to update')
  t.deepEqual(response.data, [])
  t.is(updateOne.callCount, 0)
})

test('should delete one item', async (t) => {
  const deleteOne = sinon.stub().returns({ deletedCount: 1 })
  const connection = createConnection({ deleteOne })
  const exchange = {
    ...defaultExchange,
    type: 'DELETE',
    request: {
      id: 'ent1',
      type: 'entry',
      data: { id: 'ent1', $type: 'entry' },
    },
    options: {
      collection: 'documents',
      db: 'database',
    },
  }
  const expectedData = [{ id: 'ent1', $type: 'entry', status: 'ok' }]

  const { status, response } = await send(exchange, connection)

  t.is(status, 'ok')
  t.deepEqual(response.data, expectedData)
  t.is(deleteOne.callCount, 1)
  t.true(deleteOne.calledWith({ _id: 'entry:ent1' }))
})

test('should return error when the item cannot be deleted', async (t) => {
  const deleteOne = sinon.stub().throws(new Error('Mongo error'))
  const connection = createConnection({ deleteOne })
  const exchange = {
    ...defaultExchange,
    type: 'DELETE',
    request: {
      id: 'ent3',
      type: 'entry',
      data: { id: 'ent3', $type: 'entry' },
    },
    options: {
      collection: 'documents',
      db: 'database',
    },
  }
  const expectedResonse = {
    error: 'Error deleting item(s) in mongodb',
    data: [
      { id: 'ent3', $type: 'entry', status: 'error', error: 'Mongo error' },
    ],
  }

  const { status, response } = await send(exchange, connection)

  t.is(status, 'error')
  t.deepEqual(response, expectedResonse)
})

test('should delete items', async (t) => {
  const deleteOne = sinon.stub().returns({ deletedCount: 1 })
  const connection = createConnection({ deleteOne })
  const exchange = {
    ...defaultExchange,
    type: 'DELETE',
    request: {
      data: [
        { id: 'ent1', $type: 'entry' },
        { id: 'ent2', $type: 'entry' },
      ],
    },
    options: {
      collection: 'documents',
      db: 'database',
    },
  }
  const expectedData = [
    { id: 'ent1', $type: 'entry', status: 'ok' },
    { id: 'ent2', $type: 'entry', status: 'ok' },
  ]

  const { status, response } = await send(exchange, connection)

  t.is(status, 'ok')
  t.deepEqual(response.data, expectedData)
  t.is(deleteOne.callCount, 2)
  t.true(deleteOne.calledWith({ _id: 'entry:ent1' }))
  t.true(deleteOne.calledWith({ _id: 'entry:ent2' }))
})

test('should return error when one of the items cannot be deleted', async (t) => {
  const deleteOne = sinon.stub()
  deleteOne.onFirstCall().returns({ deletedCount: 1 })
  deleteOne.onSecondCall().throws(new Error('Mongo error'))
  const connection = createConnection({ deleteOne })
  const exchange = {
    ...defaultExchange,
    type: 'DELETE',
    request: {
      data: [
        { id: 'ent3', $type: 'entry' },
        { id: 'ent4', $type: 'entry' },
      ],
    },
    options: {
      collection: 'documents',
      db: 'database',
    },
  }
  const expectedResponse = {
    error: 'Error deleting item(s) in mongodb',
    data: [
      { id: 'ent3', $type: 'entry', status: 'ok' },
      { id: 'ent4', $type: 'entry', status: 'error', error: 'Mongo error' },
    ],
  }

  const { status, response } = await send(exchange, connection)

  t.is(status, 'error')
  t.deepEqual(response, expectedResponse)
})

test('should return noaction for unknown action', async (t) => {
  const connection = createConnection({})
  const exchange = {
    ...defaultExchange,
    type: 'UNKNOWN',
    request: { type: 'entry', data: null },
    options: {
      collection: 'documents',
      db: 'database',
    },
  }

  const { status } = await send(exchange, connection)

  t.is(status, 'noaction')
})

test('should return badrequest when no collection', async (t) => {
  const find = createFind([
    { id: 'ent1', $type: 'entry' },
    { id: 'ent2', $type: 'entry' },
  ])
  const connection = createConnection({ find })
  const exchange = {
    ...defaultExchange,
    type: 'GET',
    request: {
      type: 'entry',
      params: {
        typePlural: 'entries',
      },
    },
    options: {
      collection: null,
      db: 'database',
    },
  }

  const { status, response } = await send(exchange, connection)

  t.is(status, 'error')
  t.is(response.error, 'Could not get the collection specified in the request')
})

test('should return error when no client', async (t) => {
  const connection = { status: 'error' }
  const exchange = {
    ...defaultExchange,
    type: 'GET',
    request: { type: 'entry', data: null },
    options: {
      collection: 'documents',
      db: 'database',
    },
  }

  const { status, response } = await send(exchange, connection)

  t.is(status, 'error')
  t.is(response.error, 'No valid connection')
})

test('should return error when no connection', async (t) => {
  const connection = null
  const exchange = {
    ...defaultExchange,
    type: 'GET',
    request: { type: 'entry', data: null },
    options: {
      collection: 'documents',
      db: 'database',
    },
  }

  const { status, response } = await send(exchange, connection)

  t.is(status, 'error')
  t.is(response.error, 'No valid connection')
})
