import test from 'ava'
import sinon from 'sinon'

import send from './send'

// Helpers

const createConnection = (collection) => ({
  db: (name) => (name === 'database') ? {
    collection: (name) => (name === 'documents') ? collection : null
  } : null
})

const createFind = (items) => {
  const docs = items.map((item) => ({...item, _id: `${item.type}:${item.id}`}))
  const it = docs[Symbol.iterator]()

  return sinon.stub().returns({
    // toArray returns all docs
    toArray: async () => docs,
    // Mimick limit method
    limit: (size) => ({toArray: async () => docs.slice(0, size)}),
    // Mimick next()
    next: async () => it.next().value
  })
}

// Tests

test('should get items', async (t) => {
  const find = createFind([{id: 'ent1', type: 'entry'}, {id: 'ent2', type: 'entry'}])
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

  const response = await send(request, connection)

  t.is(response.status, 'ok')
  t.is(response.data.length, 2)
  t.is(response.data[0].id, 'ent1')
  t.is(response.data[1].id, 'ent2')
  t.true(find.calledWith({type: 'entry'}))
})

test('should get one item', async (t) => {
  const find = createFind([{id: 'ent1', type: 'entry'}])
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

  const response = await send(request, connection)

  t.is(response.status, 'ok')
  t.is(response.data.length, 1)
  t.is(response.data[0].id, 'ent1')
  t.true(find.calledWith({_id: 'entry:ent1'}))
})

test('should get with query', async (t) => {
  const find = createFind([])
  const connection = createConnection({find})
  const request = {
    action: 'GET',
    params: {
      type: 'entry',
      typePlural: 'entries'
    },
    endpoint: {
      collection: 'documents',
      db: 'database',
      query: [
        {path: 'type', param: 'type'},
        {path: 'attributes\\.age.$gt', value: 18}
      ]
    }
  }
  const expected = {
    type: 'entry',
    'attributes.age': {$gt: 18}
  }

  await send(request, connection)

  const arg = find.args[0][0]
  t.deepEqual(arg, expected)
})

test('should get one page of items', async (t) => {
  const find = createFind([
    {id: 'ent1', type: 'entry'},
    {id: 'ent2', type: 'entry'},
    {id: 'ent3', type: 'entry'}
  ])
  const connection = createConnection({find})
  const request = {
    action: 'GET',
    params: {
      type: 'entry',
      typePlural: 'entries',
      pageSize: 2
    },
    endpoint: {
      collection: 'documents',
      db: 'database'
    }
  }

  const response = await send(request, connection)

  t.is(response.status, 'ok')
  t.is(response.data.length, 2)
  t.is(response.data[0].id, 'ent1')
  t.is(response.data[1].id, 'ent2')
  t.true(find.calledWith({type: 'entry'}))
})

test('should return params for next page', async (t) => {
  const find = createFind([
    {id: 'ent1', type: 'entry'},
    {id: 'ent2', type: 'entry'}
  ])
  const connection = createConnection({find})
  const request = {
    action: 'GET',
    params: {
      type: 'entry',
      typePlural: 'entries',
      pageSize: 2
    },
    endpoint: {
      collection: 'documents',
      db: 'database'
    }
  }
  const expectedPaging = {
    next: {
      query: {_id: {$gte: 'entry:ent2'}},
      pageAfter: 'entry:ent2',
      pageSize: 2
    }
  }

  const response = await send(request, connection)

  t.deepEqual(response.paging, expectedPaging)
})

test('should get second page of items', async (t) => {
  const find = createFind([
    {id: 'ent2', type: 'entry'},
    {id: 'ent3', type: 'entry'},
    {id: 'ent4', type: 'entry'}
  ])
  const connection = createConnection({find})
  const request = {
    action: 'GET',
    params: {
      type: 'entry',
      typePlural: 'entries',
      query: {_id: {$gte: 'entry:ent2'}},
      pageAfter: 'entry:ent2',
      pageSize: 2
    },
    endpoint: {
      collection: 'documents',
      db: 'database'
    }
  }
  const expectedPaging = {
    next: {
      query: {_id: {$gte: 'entry:ent4'}},
      pageAfter: 'entry:ent4',
      pageSize: 2
    }
  }

  const response = await send(request, connection)

  t.deepEqual(find.args[0][0], {type: 'entry', _id: {$gte: 'entry:ent2'}})
  t.is(response.status, 'ok')
  t.is(response.data.length, 2)
  t.is(response.data[0].id, 'ent3')
  t.is(response.data[1].id, 'ent4')
  t.deepEqual(response.paging, expectedPaging)
})

test('should return empty array when collection query comes back empty', async (t) => {
  const find = createFind([])
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

  const response = await send(request, connection)

  t.is(response.status, 'ok')
  t.is(response.data.length, 0)
})

test('should return notfound when member query comes back empty', async (t) => {
  const find = createFind([])
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
    status: 'notfound',
    error: 'Could not find \'ent1\' of type \'entry\''
  }

  const response = await send(request, connection)

  t.deepEqual(response, expected)
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
  const _id = 'entry:ent1'

  const response = await send(request, connection)

  t.deepEqual(response, expected)
  t.is(updateOne.callCount, 1)
  t.true(updateOne.calledWith({_id: 'entry:ent1'}, {$set: {...data, _id}}))
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
    error: 'Error updating item(s) in mongodb',
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
  t.true(updateOne.calledWith({_id: 'entry:ent1'}, {$set: {...data[0], _id: 'entry:ent1'}}))
  t.true(updateOne.calledWith({_id: 'entry:ent2'}, {$set: {...data[1], _id: 'entry:ent2'}}))
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
    error: 'Error updating item(s) in mongodb',
    data: [
      {id: 'ent1', type: 'entry', status: 'ok'},
      {id: 'ent2', type: 'entry', status: 'error', error: 'Mongo error'}
    ]
  }

  const response = await send(request, connection)

  t.deepEqual(response, expected)
  t.is(updateOne.callCount, 2)
  t.true(updateOne.calledWith({_id: 'entry:ent1'}, {$set: {...data[0], _id: 'entry:ent1'}}))
  t.true(updateOne.calledWith({_id: 'entry:ent2'}, {$set: {...data[1], _id: 'entry:ent2'}}))
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
  const _id = 'entry:ent3'

  const response = await send(request, connection)

  t.deepEqual(response, expected)
  t.is(updateOne.callCount, 1)
  t.true(updateOne.calledWith({_id: 'entry:ent3'}, {$set: {...data, _id}}, {upsert: true}))
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
  t.true(deleteOne.calledWith({_id: 'entry:ent1'}))
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
    error: 'Error deleting item(s) in mongodb',
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
  t.true(deleteOne.calledWith({_id: 'entry:ent1'}))
  t.true(deleteOne.calledWith({_id: 'entry:ent2'}))
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
    error: 'Error deleting item(s) in mongodb',
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
