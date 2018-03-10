import test from 'ava'
import sinon from 'sinon'

import send from './send'

// Helpers

const createConnection = (collection) => ({
  db: (name) => (name === 'database') ? {
    collection: (name) => (name === 'documents') ? collection : null
  } : null
})

// Tests

test('should get items', async (t) => {
  const find = sinon.stub().returns({
    toArray: () => [{id: 'ent1', type: 'entry'}, {id: 'ent2', type: 'entry'}]
  })
  const connection = createConnection({find})
  const request = {
    action: 'GET',
    params: {
      type: 'entry',
      typePlural: 'entries'
    },
    endpoint: {
      collection: 'documents',
      db: 'database'
    }
  }
  const expected = {
    status: 'ok',
    data: [
      {id: 'ent1', type: 'entry'},
      {id: 'ent2', type: 'entry'}
    ]
  }

  const response = await send(request, connection)

  t.deepEqual(response, expected)
  t.true(find.calledWith({type: 'entry'}))
})

test('should get one item', async (t) => {
  const find = sinon.stub().returns({
    toArray: () => [{id: 'ent1', type: 'entry'}]
  })
  const connection = createConnection({find})
  const request = {
    action: 'GET',
    params: {
      id: 'ent1',
      type: 'entry',
      typePlural: 'entries'
    },
    endpoint: {
      collection: 'documents',
      db: 'database'
    }
  }
  const expected = {
    status: 'ok',
    data: [
      {id: 'ent1', type: 'entry'}
    ]
  }

  const response = await send(request, connection)

  t.deepEqual(response, expected)
  t.true(find.calledWith({type: 'entry', id: 'ent1'}))
})

test('should update one item', async (t) => {
  const updateOne = sinon.stub().returns({
    matchedCount: 1, modifiedCount: 1, upsertedCount: 0
  })
  const connection = createConnection({updateOne})
  const data = {id: 'ent1', type: 'entry', attributes: {title: 'Entry 1'}}
  const request = {
    action: 'SET',
    params: {},
    data,
    endpoint: {
      collection: 'documents',
      db: 'database'
    }
  }
  const expected = {
    status: 'ok',
    data: [{id: 'ent1', type: 'entry', status: 'ok'}]
  }

  const response = await send(request, connection)

  t.deepEqual(response, expected)
  t.is(updateOne.callCount, 1)
  t.true(updateOne.calledWith({type: 'entry', id: 'ent1'}, {$set: data}))
})

test('should return error when data cannot be updated', async (t) => {
  const updateOne = sinon.stub().throws(new Error('Mongo error'))
  const connection = createConnection({updateOne})
  const data = {id: 'ent1', type: 'entry', attributes: {title: 'Entry 1'}}
  const request = {
    action: 'SET',
    params: {},
    data,
    endpoint: {
      collection: 'documents',
      db: 'database'
    }
  }
  const expected = {
    status: 'error',
    error: 'Error updating item in mongodb',
    data: [{id: 'ent1', type: 'entry', status: 'error', error: 'Mongo error'}]
  }

  const response = await send(request, connection)

  t.deepEqual(response, expected)
})

test('should update items', async (t) => {
  const updateOne = sinon.stub().returns({
    matchedCount: 1, modifiedCount: 1, upsertedCount: 0
  })
  const connection = createConnection({updateOne})
  const data = [
    {id: 'ent1', type: 'entry', attributes: {title: 'Entry 1'}},
    {id: 'ent2', type: 'entry', attributes: {title: 'Entry 2'}}
  ]
  const request = {
    action: 'SET',
    data,
    endpoint: {
      collection: 'documents',
      db: 'database'
    }
  }
  const expected = {
    status: 'ok',
    data: [
      {id: 'ent1', type: 'entry', status: 'ok'},
      {id: 'ent2', type: 'entry', status: 'ok'}
    ]
  }

  const response = await send(request, connection)

  t.deepEqual(response, expected)
  t.is(updateOne.callCount, 2)
  t.true(updateOne.calledWith({type: 'entry', id: 'ent1'}, {$set: data[0]}))
  t.true(updateOne.calledWith({type: 'entry', id: 'ent2'}, {$set: data[1]}))
})

test('should return error when one of the items cannot be updated', async (t) => {
  const updateOne = sinon.stub()
  updateOne.onFirstCall().returns({
    matchedCount: 1, modifiedCount: 1, upsertedCount: 0
  })
  updateOne.onSecondCall().throws(new Error('Mongo error'))
  const connection = createConnection({updateOne})
  const data = [
    {id: 'ent1', type: 'entry', attributes: {title: 'Entry 1'}},
    {id: 'ent2', type: 'entry', attributes: {title: 'Entry 2'}}
  ]
  const request = {
    action: 'SET',
    data,
    endpoint: {
      collection: 'documents',
      db: 'database'
    }
  }
  const expected = {
    status: 'error',
    error: 'Error updating one or more items in mongodb',
    data: [
      {id: 'ent1', type: 'entry', status: 'ok'},
      {id: 'ent2', type: 'entry', status: 'error', error: 'Mongo error'}
    ]
  }

  const response = await send(request, connection)

  t.deepEqual(response, expected)
  t.is(updateOne.callCount, 2)
  t.true(updateOne.calledWith({type: 'entry', id: 'ent1'}, {$set: data[0]}))
  t.true(updateOne.calledWith({type: 'entry', id: 'ent2'}, {$set: data[1]}))
})

test('should insert one item', async (t) => {
  const updateOne = sinon.stub().returns({
    matchedCount: 0, modifiedCount: 0, upsertedCount: 1
  })
  const connection = createConnection({updateOne})
  const data = {id: 'ent3', type: 'entry', attributes: {title: 'Entry 3'}}
  const request = {
    action: 'SET',
    params: {},
    data,
    endpoint: {
      collection: 'documents',
      db: 'database'
    }
  }
  const expected = {
    status: 'ok',
    data: [{id: 'ent3', type: 'entry', status: 'ok'}]
  }

  const response = await send(request, connection)

  t.deepEqual(response, expected)
  t.is(updateOne.callCount, 1)
  t.true(updateOne.calledWith({type: 'entry', id: 'ent3'}, {$set: data}, {upsert: true}))
})

test('should delete one item', async (t) => {
  const deleteOne = sinon.stub().returns({deletedCount: 1})
  const connection = createConnection({deleteOne})
  const request = {
    action: 'DELETE',
    params: {id: 'ent1', type: 'entry'},
    data: {id: 'ent1', type: 'entry'},
    endpoint: {
      collection: 'documents',
      db: 'database'
    }
  }
  const expected = {
    status: 'ok',
    data: [{id: 'ent1', type: 'entry', status: 'ok'}]
  }

  const response = await send(request, connection)

  t.deepEqual(response, expected)
  t.is(deleteOne.callCount, 1)
  t.true(deleteOne.calledWith({type: 'entry', id: 'ent1'}))
})

test('should return error when the item cannot be deleted', async (t) => {
  const deleteOne = sinon.stub().throws(new Error('Mongo error'))
  const connection = createConnection({deleteOne})
  const request = {
    action: 'DELETE',
    params: {id: 'ent3', type: 'entry'},
    data: {id: 'ent3', type: 'entry'},
    endpoint: {
      collection: 'documents',
      db: 'database'
    }
  }
  const expected = {
    status: 'error',
    error: 'Error deleting item in mongodb',
    data: [{id: 'ent3', type: 'entry', status: 'error', error: 'Mongo error'}]
  }

  const response = await send(request, connection)

  t.deepEqual(response, expected)
})

test('should delete items', async (t) => {
  const deleteOne = sinon.stub().returns({deletedCount: 1})
  const connection = createConnection({deleteOne})
  const request = {
    action: 'DELETE',
    params: {},
    data: [
      {id: 'ent1', type: 'entry'},
      {id: 'ent2', type: 'entry'}
    ],
    endpoint: {
      collection: 'documents',
      db: 'database'
    }
  }
  const expected = {
    status: 'ok',
    data: [
      {id: 'ent1', type: 'entry', status: 'ok'},
      {id: 'ent2', type: 'entry', status: 'ok'}
    ]
  }

  const response = await send(request, connection)

  t.deepEqual(response, expected)
  t.is(deleteOne.callCount, 2)
  t.true(deleteOne.calledWith({type: 'entry', id: 'ent1'}))
  t.true(deleteOne.calledWith({type: 'entry', id: 'ent2'}))
})

test('should return error when one of the items cannot be deleted', async (t) => {
  const deleteOne = sinon.stub()
  deleteOne.onFirstCall().returns({deletedCount: 1})
  deleteOne.onSecondCall().throws(new Error('Mongo error'))
  const connection = createConnection({deleteOne})
  const request = {
    action: 'DELETE',
    params: {},
    data: [
      {id: 'ent3', type: 'entry'},
      {id: 'ent4', type: 'entry'}
    ],
    endpoint: {
      collection: 'documents',
      db: 'database'
    }
  }
  const expected = {
    status: 'error',
    error: 'Error deleting one or more items in mongodb',
    data: [
      {id: 'ent3', type: 'entry', status: 'ok'},
      {id: 'ent4', type: 'entry', status: 'error', error: 'Mongo error'}
    ]
  }

  const response = await send(request, connection)

  t.deepEqual(response, expected)
})

test('should return noaction for unknown action', async (t) => {
  const connection = createConnection({})
  const request = {
    action: 'UNKNOWN',
    params: {type: 'entry'},
    data: {},
    endpoint: {
      collection: 'documents',
      db: 'database'
    }
  }
  const expected = {
    status: 'noaction'
  }

  const response = await send(request, connection)

  t.deepEqual(response, expected)
})
