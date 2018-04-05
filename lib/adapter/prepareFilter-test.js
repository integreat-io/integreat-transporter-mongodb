import test from 'ava'

import prepareFilter from './prepareFilter'

test('should return type filter', (t) => {
  const params = {type: 'entry'}
  const endpoint = {
    collection: 'documents',
    db: 'database'
  }
  const expected = {type: 'entry'}

  const ret = prepareFilter(params, endpoint, params)

  t.deepEqual(ret, expected)
})

test('should return _id filter', (t) => {
  const params = {type: 'entry', id: 'ent1'}
  const endpoint = {
    collection: 'documents',
    db: 'database'
  }
  const expected = {_id: 'entry:ent1'}

  const ret = prepareFilter(params, endpoint, params)

  t.deepEqual(ret, expected)
})

test('should use endpoint.query as filter', (t) => {
  const params = {type: 'entry', id: 'ent1'}
  const endpoint = {
    collection: 'documents',
    db: 'database',
    query: [
      {path: 'type', value: 'other'},
      {path: 'attributes\\.parentType', param: 'type'}
    ]
  }
  const expected = {
    type: 'other',
    'attributes.parentType': 'entry'
  }

  const ret = prepareFilter(params, endpoint, params)

  t.deepEqual(ret, expected)
})

test('should add params query to endpoint query filter', (t) => {
  const params = {
    type: 'entry',
    query: {'attributes.section': 'news'}
  }
  const endpoint = {
    collection: 'documents',
    db: 'database',
    query: [
      {path: 'type', value: 'other'},
      {path: 'attributes\\.parentType', param: 'type'}
    ]
  }
  const expected = {
    type: 'other',
    'attributes.parentType': 'entry',
    'attributes.section': 'news'
  }

  const ret = prepareFilter(params, endpoint, params)

  t.deepEqual(ret, expected)
})

test('should add params query to type filter', (t) => {
  const params = {
    type: 'entry',
    query: {'attributes.section': 'news'}
  }
  const endpoint = {
    collection: 'documents',
    db: 'database'
  }
  const expected = {
    type: 'entry',
    'attributes.section': 'news'
  }

  const ret = prepareFilter(params, endpoint, params)

  t.deepEqual(ret, expected)
})

test('should add params query to id filter', (t) => {
  const params = {
    id: 'ent1',
    type: 'entry',
    query: {'attributes.section': 'news'}
  }
  const endpoint = {
    collection: 'documents',
    db: 'database'
  }
  const expected = {
    _id: 'entry:ent1',
    'attributes.section': 'news'
  }

  const ret = prepareFilter(params, endpoint, params)

  t.deepEqual(ret, expected)
})

test('should cast date strings as Date', (t) => {
  const params = {
    type: 'entry',
    query: {'attributes.updatedAt': '2017-11-13T18:43:01.000Z'}
  }
  const endpoint = {
    collection: 'documents',
    db: 'database'
  }
  const expected = {
    type: 'entry',
    'attributes.updatedAt': new Date('2017-11-13T18:43:01.000Z')
  }

  const ret = prepareFilter(params, endpoint, params)

  t.deepEqual(ret, expected)
})

test('should cast date strings without microseconds as Date', (t) => {
  const params = {
    type: 'entry',
    query: {'attributes.updatedAt': '2017-11-13T18:43:01Z'}
  }
  const endpoint = {
    collection: 'documents',
    db: 'database'
  }
  const expected = {
    type: 'entry',
    'attributes.updatedAt': new Date('2017-11-13T18:43:01Z')
  }

  const ret = prepareFilter(params, endpoint, params)

  t.deepEqual(ret, expected)
})

test('should cast date strings with other time zone as Date', (t) => {
  const params = {
    type: 'entry',
    query: {'attributes.updatedAt': '2017-11-13T18:43:01.000+01:00'}
  }
  const endpoint = {
    collection: 'documents',
    db: 'database'
  }
  const expected = {
    type: 'entry',
    'attributes.updatedAt': new Date('2017-11-13T18:43:01.000+01:00')
  }

  const ret = prepareFilter(params, endpoint, params)

  t.deepEqual(ret, expected)
})

test('should cast date strings as Date on sub-objects', (t) => {
  const params = {
    type: 'entry',
    query: {'attributes.updatedAt': {$lte: '2017-11-13T18:43:01.000Z'}}
  }
  const endpoint = {
    collection: 'documents',
    db: 'database'
  }
  const expected = {
    type: 'entry',
    'attributes.updatedAt': {$lte: new Date('2017-11-13T18:43:01.000Z')}
  }

  const ret = prepareFilter(params, endpoint, params)

  t.deepEqual(ret, expected)
})

test('should not touch Date object when casting', (t) => {
  const params = {
    type: 'entry',
    query: {'attributes.updatedAt': new Date('2017-11-13T18:43:01.000Z')}
  }
  const endpoint = {
    collection: 'documents',
    db: 'database'
  }
  const expected = {
    type: 'entry',
    'attributes.updatedAt': new Date('2017-11-13T18:43:01.000Z')
  }

  const ret = prepareFilter(params, endpoint, params)

  t.deepEqual(ret, expected)
})

test('should not touch arrays when casting', (t) => {
  const params = {
    type: 'entry',
    query: {_id: {$in: ['entry:ent1', 'entry:ent2']}}
  }
  const endpoint = {
    collection: 'documents',
    db: 'database'
  }
  const expected = {
    type: 'entry',
    _id: {$in: ['entry:ent1', 'entry:ent2']}
  }

  const ret = prepareFilter(params, endpoint, params)

  t.deepEqual(ret, expected)
})
