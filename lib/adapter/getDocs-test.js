import test from 'ava'
import sinon from 'sinon'

import getDocs from './getDocs'

// Helpers

const createFind = (items) => {
  const docs = items.map((item) => ({...item, _id: `${item.type}:${item.id}`}))
  const it = docs[Symbol.iterator]()

  const cursor = {
    // toArray returns all docs
    toArray: async () => docs,
    // Mimick limit method
    limit: (size) => ({toArray: async () => docs.slice(0, size)}),
    // Mimick next()
    next: async () => it.next().value,
    sort: () => cursor
  }

  return sinon.stub().resolves(cursor)
}

// Tests

test('should get items', async (t) => {
  const find = createFind([{id: 'ent1', type: 'entry'}, {id: 'ent2', type: 'entry'}])
  const getCollection = () => ({find})
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

  const response = await getDocs(getCollection, request)

  t.is(response.status, 'ok')
  t.is(response.data.length, 2)
  t.is(response.data[0].id, 'ent1')
  t.is(response.data[1].id, 'ent2')
  t.true(find.calledWith({type: 'entry'}))
})

test('should get one item', async (t) => {
  const find = createFind([{id: 'ent1', type: 'entry'}])
  const getCollection = () => ({find})
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

  const response = await getDocs(getCollection, request)

  t.is(response.status, 'ok')
  t.is(response.data.length, 1)
  t.is(response.data[0].id, 'ent1')
  t.true(find.calledWith({_id: 'entry:ent1'}))
})

test('should get with query', async (t) => {
  const find = createFind([])
  const getCollection = () => ({find})
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

  await getDocs(getCollection, request)

  const arg = find.args[0][0]
  t.deepEqual(arg, expected)
})

test('should get one page of items', async (t) => {
  const find = createFind([
    {id: 'ent1', type: 'entry'},
    {id: 'ent2', type: 'entry'},
    {id: 'ent3', type: 'entry'}
  ])
  const getCollection = () => ({find})
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

  const response = await getDocs(getCollection, request)

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
  const getCollection = () => ({find})
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
      type: 'entry',
      query: {_id: {$gte: 'entry:ent2'}},
      pageAfter: 'entry:ent2',
      pageSize: 2
    }
  }

  const response = await getDocs(getCollection, request)

  t.deepEqual(response.paging, expectedPaging)
})

test('should get second page of items', async (t) => {
  const find = createFind([
    {id: 'ent2', type: 'entry'},
    {id: 'ent3', type: 'entry'},
    {id: 'ent4', type: 'entry'}
  ])
  const getCollection = () => ({find})
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
      type: 'entry',
      query: {_id: {$gte: 'entry:ent4'}},
      pageAfter: 'entry:ent4',
      pageSize: 2
    }
  }

  const response = await getDocs(getCollection, request)

  t.deepEqual(find.args[0][0], {type: 'entry', _id: {$gte: 'entry:ent2'}})
  t.is(response.status, 'ok')
  t.is(response.data.length, 2)
  t.is(response.data[0].id, 'ent3')
  t.is(response.data[1].id, 'ent4')
  t.deepEqual(response.paging, expectedPaging)
})

test('should get empty result when we have passed the last page', async (t) => {
  const find = createFind([
    {id: 'ent4', type: 'entry'}
  ])
  const getCollection = () => ({find})
  const request = {
    action: 'GET',
    params: {
      type: 'entry',
      typePlural: 'entries',
      query: {_id: {$gte: 'entry:ent4'}},
      pageAfter: 'entry:ent4',
      pageSize: 2
    },
    endpoint: {
      collection: 'documents',
      db: 'database'
    }
  }
  const expectedPaging = {
    next: null
  }

  const response = await getDocs(getCollection, request)

  t.deepEqual(find.args[0][0], {type: 'entry', _id: {$gte: 'entry:ent4'}})
  t.is(response.status, 'ok')
  t.is(response.data.length, 0)
  t.deepEqual(response.paging, expectedPaging)
})

test('should get empty result when the pageAfter doc is not found', async (t) => {
  const find = createFind([
    {id: 'ent5', type: 'entry'}
  ])
  const getCollection = () => ({find})
  const request = {
    action: 'GET',
    params: {
      type: 'entry',
      typePlural: 'entries',
      query: {_id: {$gte: 'entry:ent4'}},
      pageAfter: 'entry:ent4',
      pageSize: 2
    },
    endpoint: {
      collection: 'documents',
      db: 'database'
    }
  }
  const expectedPaging = {
    next: null
  }

  const response = await getDocs(getCollection, request)

  t.deepEqual(find.args[0][0], {type: 'entry', _id: {$gte: 'entry:ent4'}})
  t.is(response.status, 'ok')
  t.is(response.data.length, 0)
  t.deepEqual(response.paging, expectedPaging)
})

test('should get second page of items when there is documents before the pageAfter', async (t) => {
  const find = createFind([
    {id: 'ent1', type: 'entry', attributes: {index: 1}},
    {id: 'ent2', type: 'entry', attributes: {index: 1}},
    {id: 'ent3', type: 'entry', attributes: {index: 2}},
    {id: 'ent4', type: 'entry', attributes: {index: 3}}
  ])
  const getCollection = () => ({find})
  const request = {
    action: 'GET',
    params: {
      type: 'entry',
      typePlural: 'entries',
      query: {'attributes.index': {$gte: 1}},
      pageAfter: 'entry:ent2',
      pageSize: 2
    },
    endpoint: {
      collection: 'documents',
      db: 'database',
      sort: {'attributes.index': 1}
    }
  }
  const expectedPaging = {
    next: {
      type: 'entry',
      query: {'attributes.index': {$gte: 3}},
      pageAfter: 'entry:ent4',
      pageSize: 2
    }
  }

  const response = await getDocs(getCollection, request)

  t.deepEqual(find.args[0][0], {type: 'entry', 'attributes.index': {$gte: 1}})
  t.is(response.status, 'ok')
  t.is(response.data.length, 2)
  t.is(response.data[0].id, 'ent3')
  t.is(response.data[1].id, 'ent4')
  t.deepEqual(response.paging, expectedPaging)
})

test('should return empty array when collection query comes back empty', async (t) => {
  const find = createFind([])
  const getCollection = () => ({find})
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

  const response = await getDocs(getCollection, request)

  t.is(response.status, 'ok')
  t.is(response.data.length, 0)
})

test('should return notfound when member query comes back empty', async (t) => {
  const find = createFind([])
  const getCollection = () => ({find})
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

  const response = await getDocs(getCollection, request)

  t.deepEqual(response, expected)
})
