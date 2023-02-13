import test from 'ava'
import sinon = require('sinon')
import { TypedData } from 'integreat'
import {
  Collection,
  MongoClient,
  MongoBulkWriteError,
  WriteError,
  BulkWriteResult,
} from 'mongodb'

import send from './send.js'

// Helpers

const createConnection = (collection: unknown) => ({
  status: 'ok',
  mongo: {
    client: {
      db: (name: string) =>
        name === 'database'
          ? {
              collection: (name: string) =>
                name === 'documents' ? (collection as Collection) : null,
            }
          : null,
    } as MongoClient,
    count: 1,
  },
})

const createFind = (items: TypedData[]) => {
  const docs = items.map(({ $type, ...item }) => ({
    ...item,
    id: item.id,
  }))
  const it = docs[Symbol.iterator]()

  return sinon.stub().returns({
    // toArray returns all docs
    toArray: async () => docs,
    // Mimick limit method
    limit: (size: number) => ({ toArray: async () => docs.slice(0, size) }),
    // Mimick next()
    next: async () => it.next().value,
  })
}

// Tests

test('should get items', async (t) => {
  const find = createFind([
    { id: 'ent1', $type: 'entry' },
    { id: 'ent2', $type: 'entry' },
  ])
  const connection = createConnection({ find })
  const action = {
    type: 'GET',
    payload: {
      type: 'entry',
      typePlural: 'entries',
    },
    meta: {
      options: {
        collection: 'documents',
        db: 'database',
      },
    },
  }

  const response = await send(action, connection)

  t.is(response?.status, 'ok')
  const data = response?.data as TypedData[]
  t.is(data.length, 2)
  t.is(data[0].id, 'ent1')
  t.is(data[1].id, 'ent2')
})

test('should update one item', async (t) => {
  const updateOne = sinon.stub().returns({
    matchedCount: 1,
    modifiedCount: 1,
    upsertedCount: 0,
  })
  const connection = createConnection({ updateOne })
  const data = { id: 'ent1', $type: 'entry', title: 'Entry 1' }
  const action = {
    type: 'SET',
    payload: { data },
    meta: {
      options: {
        collection: 'documents',
        db: 'database',
      },
    },
  }
  const expectedData = { modifiedCount: 1, insertedCount: 0, deletedCount: 0 }
  const expectedSet = {
    $set: {
      id: 'ent1',
      '\\$type': 'entry',
      title: 'Entry 1',
    },
  }

  const response = await send(action, connection)

  t.is(response?.status, 'ok')
  t.deepEqual(response?.data, expectedData)
  t.is(updateOne.callCount, 1)
  t.deepEqual(updateOne.args[0][0], { id: 'ent1' })
  t.deepEqual(updateOne.args[0][1], expectedSet)
})

test('should update items', async (t) => {
  const updateOne = sinon.stub().returns({})
  const bulkWrite = sinon.stub().returns({
    matchedCount: 2,
    modifiedCount: 2,
    upsertedCount: 0,
  })
  const connection = createConnection({ updateOne, bulkWrite })
  const data = [
    { id: 'ent1', $type: 'entry', title: 'Entry 1' },
    { id: 'ent2', $type: 'entry', title: 'Entry 2' },
  ]
  const action = {
    type: 'SET',
    payload: { data },
    meta: {
      options: {
        collection: 'documents',
        db: 'database',
      },
    },
  }
  const expectedData = { modifiedCount: 2, insertedCount: 0, deletedCount: 0 }
  const expectedSet1 = {
    $set: {
      id: 'ent1',
      '\\$type': 'entry',
      title: 'Entry 1',
    },
  }
  const expectedSet2 = {
    $set: {
      id: 'ent2',
      '\\$type': 'entry',
      title: 'Entry 2',
    },
  }
  const expectedBulkWrite = [
    {
      updateOne: {
        filter: { id: 'ent1' },
        update: expectedSet1,
        upsert: true,
      },
    },
    {
      updateOne: {
        filter: { id: 'ent2' },
        update: expectedSet2,
        upsert: true,
      },
    },
  ]

  const response = await send(action, connection)

  t.is(response?.status, 'ok')
  t.is(updateOne.callCount, 0)
  t.is(bulkWrite.callCount, 1)
  t.deepEqual(bulkWrite.args[0][0], expectedBulkWrite)
  t.deepEqual(response?.data, expectedData)
})

test('should update object data (not Integreat typed)', async (t) => {
  const updateOne = sinon.stub().returns({
    matchedCount: 0,
    modifiedCount: 0,
    upsertedCount: 1,
  })
  const connection = createConnection({ updateOne })
  const data = { id: 'ent1', title: 'Entry 1' }
  const action = {
    type: 'SET',
    payload: { data },
    meta: {
      options: {
        collection: 'documents',
        db: 'database',
      },
    },
  }
  const expectedData = { modifiedCount: 0, insertedCount: 1, deletedCount: 0 }
  const expectedSet = {
    $set: { id: 'ent1', title: 'Entry 1' },
  }

  const response = await send(action, connection)

  t.is(response?.status, 'ok')
  t.deepEqual(response?.data, expectedData)
  t.is(updateOne.callCount, 1)
  t.deepEqual(updateOne.args[0][0], { id: 'ent1' })
  t.deepEqual(updateOne.args[0][1], expectedSet)
})

test('should return error when data cannot be updated', async (t) => {
  const updateOne = sinon.stub().throws(new Error('Mongo error'))
  const connection = createConnection({ updateOne })
  const data = { id: 'ent1', $type: 'entry', title: 'Entry 1' }
  const action = {
    type: 'SET',
    payload: { data },
    meta: {
      options: {
        collection: 'documents',
        db: 'database',
      },
    },
  }
  const expectedResponse = {
    status: 'error',
    data: {
      modifiedCount: 0,
      insertedCount: 0,
      deletedCount: 0,
    },
    error: "Error updating item 'ent1' in mongodb: Mongo error",
  }

  const response = await send(action, connection)

  t.deepEqual(response, expectedResponse)
})

test('should return error when some of the items cannot be updated', async (t) => {
  const error1 = { index: 1, code: 52, errmsg: 'Bad data!' } as WriteError
  const error2 = { index: 2, code: 52, errmsg: 'Bader data!' } as WriteError
  const mongoError = new MongoBulkWriteError(
    {
      message: 'Mongo error',
      code: 52,
      writeErrors: [error1, error2],
    },
    { matchedCount: 3, modifiedCount: 1, upsertedCount: 0 } as BulkWriteResult
  )
  const bulkWrite = sinon.stub()
  bulkWrite.throws(mongoError)
  const connection = createConnection({ bulkWrite })
  const data = [
    { id: 'ent1', $type: 'entry', title: 'Entry 1' },
    { id: 'ent2', $type: 'entry', title: 'Entry 2' },
    { id: 'ent3', $type: 'entry', title: 'Entry 3' },
  ]
  const action = {
    type: 'SET',
    payload: { data },
    meta: {
      options: {
        collection: 'documents',
        db: 'database',
      },
    },
  }
  const expectedResponse = {
    status: 'error',
    data: { modifiedCount: 1, insertedCount: 0, deletedCount: 0 },
    error:
      "Error updating items 'ent2', 'ent3' in mongodb: Bad data! | Bader data!",
  }

  const response = await send(action, connection)

  t.deepEqual(response, expectedResponse)
  t.is(bulkWrite.callCount, 1)
})

test('should insert one item', async (t) => {
  const updateOne = sinon.stub().returns({
    matchedCount: 0,
    modifiedCount: 0,
    upsertedCount: 1,
  })
  const connection = createConnection({ updateOne })
  const data = { id: 'ent3', $type: 'entry', title: 'Entry 3' }
  const action = {
    type: 'SET',
    payload: { data },
    meta: {
      options: {
        collection: 'documents',
        db: 'database',
      },
    },
  }
  const expectedData = { modifiedCount: 0, insertedCount: 1, deletedCount: 0 }
  const expectedSet = {
    $set: { id: 'ent3', '\\$type': 'entry', title: 'Entry 3' },
  }

  const response = await send(action, connection)

  t.is(response?.status, 'ok')
  t.deepEqual(response?.data, expectedData)
  t.is(updateOne.callCount, 1)
  t.deepEqual(updateOne.args[0][0], { id: 'ent3' })
  t.deepEqual(updateOne.args[0][1], expectedSet)
  t.deepEqual(updateOne.args[0][2], { upsert: true })
})

test('should return noaction when no item', async (t) => {
  const updateOne = sinon.stub().returns({
    matchedCount: 1,
    modifiedCount: 1,
    upsertedCount: 0,
  })
  const connection = createConnection({ updateOne })
  const action = {
    type: 'SET',
    payload: { data: undefined },
    meta: {
      options: {
        collection: 'documents',
        db: 'database',
      },
    },
  }

  const response = await send(action, connection)

  t.is(response?.status, 'noaction')
  t.is(response?.error, 'No items to update')
  t.deepEqual(response?.data, [])
  t.is(updateOne.callCount, 0)
})

test('should return badrequest when trying to set non-object', async (t) => {
  const updateOne = sinon.stub().returns({
    matchedCount: 1,
    modifiedCount: 1,
    upsertedCount: 0,
  })
  const connection = createConnection({ updateOne })
  const action = {
    type: 'SET',
    payload: { data: ['fisk'] },
    meta: {
      options: {
        collection: 'documents',
        db: 'database',
      },
    },
  }

  const response = await send(action, connection)

  t.is(response?.status, 'badrequest')
  t.is(
    response?.error,
    "Error updating item '<no id>' in mongodb: Only object data with an id may be sent to MongoDB"
  )
  t.is(updateOne.callCount, 0)
})

test('should delete one item', async (t) => {
  const deleteOne = sinon.stub().returns({ deletedCount: 1 })
  const connection = createConnection({ deleteOne })
  const action = {
    type: 'DELETE',
    payload: {
      id: 'ent1',
      type: 'entry',
      data: { id: 'ent1', $type: 'entry' },
    },
    meta: {
      options: {
        collection: 'documents',
        db: 'database',
      },
    },
  }
  const expectedData = { modifiedCount: 0, insertedCount: 0, deletedCount: 1 }

  const response = await send(action, connection)

  t.is(response?.status, 'ok')
  t.deepEqual(response?.data, expectedData)
  t.is(deleteOne.callCount, 1)
  t.true(deleteOne.calledWith({ id: 'ent1' }))
})

test('should return error when the item cannot be deleted', async (t) => {
  const deleteOne = sinon.stub().throws(new Error('Mongo error'))
  const connection = createConnection({ deleteOne })
  const action = {
    type: 'DELETE',
    payload: {
      id: 'ent3',
      type: 'entry',
      data: { id: 'ent3', $type: 'entry' },
    },
    meta: {
      options: {
        collection: 'documents',
        db: 'database',
      },
    },
  }
  const expectedResonse = {
    status: 'error',
    data: {
      modifiedCount: 0,
      insertedCount: 0,
      deletedCount: 0,
    },
    error: "Error deleting item 'ent3' in mongodb: Mongo error",
  }

  const response = await send(action, connection)

  t.deepEqual(response, expectedResonse)
})

test('should delete items', async (t) => {
  const deleteOne = sinon.stub().returns({ deletedCount: 0 })
  const bulkWrite = sinon.stub().returns({
    matchedCount: 0,
    modifiedCount: 0,
    upsertedCount: 0,
    deletedCount: 2,
  })
  const connection = createConnection({ deleteOne, bulkWrite })
  const action = {
    type: 'DELETE',
    payload: {
      data: [
        { id: 'ent1', $type: 'entry' },
        { id: 'ent2', $type: 'entry' },
      ],
    },
    meta: {
      options: {
        collection: 'documents',
        db: 'database',
      },
    },
  }
  const expectedData = { modifiedCount: 0, insertedCount: 0, deletedCount: 2 }
  const expectedBulkWrite = [
    { deleteOne: { filter: { id: 'ent1' } } },
    { deleteOne: { filter: { id: 'ent2' } } },
  ]

  const response = await send(action, connection)

  t.is(response?.status, 'ok')
  t.is(deleteOne.callCount, 0)
  t.deepEqual(bulkWrite.args[0][0], expectedBulkWrite)
  t.deepEqual(response?.data, expectedData)
})

test('should return error when one of the items cannot be deleted', async (t) => {
  const error1 = { index: 1, code: 52, errmsg: 'Keeping it' } as WriteError
  const mongoError = new MongoBulkWriteError(
    {
      message: 'Mongo error',
      code: 52,
      writeErrors: [error1],
    },
    {
      matchedCount: 1,
      modifiedCount: 0,
      upsertedCount: 0,
      deletedCount: 1,
    } as BulkWriteResult
  )
  const bulkWrite = sinon.stub()
  bulkWrite.throws(mongoError)
  const connection = createConnection({ bulkWrite })
  const action = {
    type: 'DELETE',
    payload: {
      data: [
        { id: 'ent3', $type: 'entry' },
        { id: 'ent4', $type: 'entry' },
      ],
    },
    meta: {
      options: {
        collection: 'documents',
        db: 'database',
      },
    },
  }
  const expectedResponse = {
    status: 'error',
    data: { modifiedCount: 0, insertedCount: 0, deletedCount: 1 },
    error: "Error deleting item 'ent4' in mongodb: Keeping it",
  }

  const response = await send(action, connection)

  t.deepEqual(response, expectedResponse)
})

test('should return noaction for unknown action', async (t) => {
  const connection = createConnection({})
  const action = {
    type: 'UNKNOWN',
    payload: { type: 'entry', data: null },
    meta: {
      options: {
        collection: 'documents',
        db: 'database',
      },
    },
  }

  const response = await send(action, connection)

  t.is(response?.status, 'noaction')
})

test('should return badrequest when GETting with no collection', async (t) => {
  const find = createFind([
    { id: 'ent1', $type: 'entry' },
    { id: 'ent2', $type: 'entry' },
  ])
  const connection = createConnection({ find })
  const action = {
    type: 'GET',
    payload: {
      type: 'entry',
      typePlural: 'entries',
    },
    meta: {
      options: {
        collection: null,
        db: 'database',
      },
    },
  }

  const response = await send(action, connection)

  t.is(response?.status, 'error')
  t.is(response?.error, 'Could not get the collection specified in the request')
})

test('should return badrequest when SETting with no collection', async (t) => {
  const find = createFind([
    { id: 'ent1', $type: 'entry' },
    { id: 'ent2', $type: 'entry' },
  ])
  const connection = createConnection({ find })
  const action = {
    type: 'SET',
    payload: { data: { id: 'ent1', $type: 'entry' } },
    meta: {
      options: {
        collection: null,
        db: 'database',
      },
    },
  }

  const response = await send(action, connection)

  t.is(response?.status, 'error')
  t.is(response?.error, 'Could not get the collection specified in the request')
})

test('should return error when no client', async (t) => {
  const connection = { status: 'error' }
  const action = {
    type: 'GET',
    payload: { type: 'entry', data: null },
    meta: {
      options: {
        collection: 'documents',
        db: 'database',
      },
    },
  }

  const response = await send(action, connection)

  t.is(response?.status, 'error')
  t.is(response?.error, 'No valid connection')
})

test('should return error when no connection', async (t) => {
  const connection = null
  const action = {
    type: 'GET',
    payload: { type: 'entry', data: null },
    meta: {
      options: {
        collection: 'documents',
        db: 'database',
      },
    },
  }

  const response = await send(action, connection)

  t.is(response?.status, 'error')
  t.is(response?.error, 'No valid connection')
})

test('should return badrequest when no options', async (t) => {
  const find = createFind([{ id: 'ent1', $type: 'entry' }])
  const connection = createConnection({ find })
  const action = {
    type: 'SET',
    payload: { data: { id: 'ent1', $type: 'entry' } },
  }

  const response = await send(action, connection)

  t.is(response?.status, 'badrequest')
  t.is(response?.error, 'No endpoint options')
})
