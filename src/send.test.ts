import test from 'ava'
import sinon = require('sinon')
import { TypedData } from 'integreat'
import { Collection, MongoClient } from 'mongodb'

import send from './send'

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
    _id: `${$type}:${item.id}`,
    '\\$type': $type,
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
  t.is(data[0].$type, 'entry')
  t.is(data[1].id, 'ent2')
  t.true(find.calledWith({ '\\$type': 'entry' }))
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
      _id: 'entry:ent1',
      id: 'ent1',
      '\\$type': 'entry',
      title: 'Entry 1',
    },
  }

  const response = await send(action, connection)

  t.is(response?.status, 'ok')
  t.deepEqual(response?.data, expectedData)
  t.is(updateOne.callCount, 1)
  t.deepEqual(updateOne.args[0][0], { _id: 'entry:ent1' })
  t.deepEqual(updateOne.args[0][1], expectedSet)
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
      _id: 'entry:ent1',
      id: 'ent1',
      '\\$type': 'entry',
      title: 'Entry 1',
    },
  }
  const expectedSet2 = {
    $set: {
      _id: 'entry:ent2',
      id: 'ent2',
      '\\$type': 'entry',
      title: 'Entry 2',
    },
  }

  const response = await send(action, connection)

  t.is(response?.status, 'ok')
  t.deepEqual(response?.data, expectedData)
  t.is(updateOne.callCount, 2)
  t.true(updateOne.calledWith({ _id: 'entry:ent1' }, expectedSet1))
  t.true(updateOne.calledWith({ _id: 'entry:ent2' }, expectedSet2))
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
    $set: { _id: 'ent1', id: 'ent1', title: 'Entry 1' },
  }

  const response = await send(action, connection)

  t.is(response?.status, 'ok')
  t.deepEqual(response?.data, expectedData)
  t.is(updateOne.callCount, 1)
  t.deepEqual(updateOne.args[0][0], { _id: 'ent1' })
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
    error: "Error updating item 'entry:ent1' in mongodb: Mongo error",
  }

  const response = await send(action, connection)

  t.deepEqual(response, expectedResponse)
})

test('should return error when some of the items cannot be updated', async (t) => {
  const updateOne = sinon.stub()
  updateOne.onFirstCall().returns({
    matchedCount: 1,
    modifiedCount: 1,
    upsertedCount: 0,
  })
  updateOne.onSecondCall().throws(new Error('Mongo error'))
  updateOne.onThirdCall().throws(new Error('Mongo error'))
  const connection = createConnection({ updateOne })
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
      "Error updating items 'entry:ent2', 'entry:ent3' in mongodb: Mongo error | Mongo error",
  }

  const response = await send(action, connection)

  t.deepEqual(response, expectedResponse)
  t.is(updateOne.callCount, 3)
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
  const _id = 'entry:ent3'
  const expectedSet = {
    $set: { _id, id: 'ent3', '\\$type': 'entry', title: 'Entry 3' },
  }

  const response = await send(action, connection)

  t.is(response?.status, 'ok')
  t.deepEqual(response?.data, expectedData)
  t.is(updateOne.callCount, 1)
  t.deepEqual(updateOne.args[0][0], { _id: 'entry:ent3' })
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
  t.true(deleteOne.calledWith({ _id: 'entry:ent1' }))
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
    error: "Error deleting item 'entry:ent3' in mongodb: Mongo error",
  }

  const response = await send(action, connection)

  t.deepEqual(response, expectedResonse)
})

test('should delete items', async (t) => {
  const deleteOne = sinon.stub().returns({ deletedCount: 1 })
  const connection = createConnection({ deleteOne })
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

  const response = await send(action, connection)

  t.is(response?.status, 'ok')
  t.deepEqual(response?.data, expectedData)
  t.is(deleteOne.callCount, 2)
  t.true(deleteOne.calledWith({ _id: 'entry:ent1' }))
  t.true(deleteOne.calledWith({ _id: 'entry:ent2' }))
})

test('should return error when one of the items cannot be deleted', async (t) => {
  const deleteOne = sinon.stub()
  deleteOne.onFirstCall().returns({ deletedCount: 1 })
  deleteOne.onSecondCall().throws(new Error('Mongo error'))
  const connection = createConnection({ deleteOne })
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
    error: "Error deleting item 'entry:ent4' in mongodb: Mongo error",
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
