import test from 'ava'

import prepareFilter from './prepareFilter'

// Tests

test('should return type filter', (t) => {
  const type = 'entry'
  const options = {
    collection: 'documents',
    db: 'database',
  }
  const expected = { type: 'entry' }

  const ret = prepareFilter(options, type)

  t.deepEqual(ret, expected)
})

test('should return _id filter', (t) => {
  const type = 'entry'
  const id = 'ent1'
  const options = {
    collection: 'documents',
    db: 'database',
  }
  const expected = { _id: 'entry:ent1' }

  const ret = prepareFilter(options, type, id)

  t.deepEqual(ret, expected)
})

test('should use options.query as filter', (t) => {
  const type = 'entry'
  const id = 'ent1'
  const options = {
    collection: 'documents',
    db: 'database',
    query: [
      { path: 'type', value: 'other' },
      { path: 'meta\\.parentType', param: 'type' },
    ],
  }
  const expected = {
    type: 'other',
    'meta.parentType': 'entry',
  }

  const ret = prepareFilter(options, type, id)

  t.deepEqual(ret, expected)
})

test('should add request query to options query filter', (t) => {
  const type = 'entry'
  const params = {
    query: { 'meta.section': 'news' },
  }
  const options = {
    collection: 'documents',
    db: 'database',
    query: [
      { path: 'type', value: 'other' },
      { path: 'meta\\.parentType', param: 'type' },
    ],
  }
  const expected = {
    type: 'other',
    'meta.parentType': 'entry',
    'meta.section': 'news',
  }

  const ret = prepareFilter(options, type, undefined, params)

  t.deepEqual(ret, expected)
})

test('should add request query to type filter', (t) => {
  const type = 'entry'
  const params = {
    query: { 'meta.section': 'news' },
  }
  const options = {
    collection: 'documents',
    db: 'database',
  }
  const expected = {
    type: 'entry',
    'meta.section': 'news',
  }

  const ret = prepareFilter(options, type, undefined, params)

  t.deepEqual(ret, expected)
})

test('should add request query to id filter', (t) => {
  const id = 'ent1'
  const type = 'entry'
  const params = {
    query: { 'meta.section': 'news' },
  }
  const options = {
    collection: 'documents',
    db: 'database',
  }
  const expected = {
    _id: 'entry:ent1',
    'meta.section': 'news',
  }

  const ret = prepareFilter(options, type, id, params)

  t.deepEqual(ret, expected)
})

test('should cast date strings as Date', (t) => {
  const type = 'entry'
  const params = {
    query: { 'meta.updatedAt': '2017-11-13T18:43:01.000Z' },
  }
  const options = {
    collection: 'documents',
    db: 'database',
  }
  const expected = {
    type: 'entry',
    'meta.updatedAt': new Date('2017-11-13T18:43:01.000Z'),
  }

  const ret = prepareFilter(options, type, undefined, params)

  t.deepEqual(ret, expected)
})

test('should cast date strings without microseconds as Date', (t) => {
  const type = 'entry'
  const params = {
    query: { 'meta.updatedAt': '2017-11-13T18:43:01Z' },
  }
  const options = {
    collection: 'documents',
    db: 'database',
  }
  const expected = {
    type: 'entry',
    'meta.updatedAt': new Date('2017-11-13T18:43:01Z'),
  }

  const ret = prepareFilter(options, type, undefined, params)

  t.deepEqual(ret, expected)
})

test('should cast date strings with other time zone as Date', (t) => {
  const type = 'entry'
  const params = {
    query: { 'meta.updatedAt': '2017-11-13T18:43:01.000+01:00' },
  }
  const options = {
    collection: 'documents',
    db: 'database',
  }
  const expected = {
    type: 'entry',
    'meta.updatedAt': new Date('2017-11-13T18:43:01.000+01:00'),
  }

  const ret = prepareFilter(options, type, undefined, params)

  t.deepEqual(ret, expected)
})

test('should cast date strings as Date on sub-objects', (t) => {
  const type = 'entry'
  const params = {
    query: { 'meta.updatedAt': { $lte: '2017-11-13T18:43:01.000Z' } },
  }
  const options = {
    collection: 'documents',
    db: 'database',
  }
  const expected = {
    type: 'entry',
    'meta.updatedAt': { $lte: new Date('2017-11-13T18:43:01.000Z') },
  }

  const ret = prepareFilter(options, type, undefined, params)

  t.deepEqual(ret, expected)
})

test('should not touch Date object when casting', (t) => {
  const type = 'entry'
  const params = {
    query: { 'meta.updatedAt': new Date('2017-11-13T18:43:01.000Z') },
  }
  const options = {
    collection: 'documents',
    db: 'database',
  }
  const expected = {
    type: 'entry',
    'meta.updatedAt': new Date('2017-11-13T18:43:01.000Z'),
  }

  const ret = prepareFilter(options, type, undefined, params)

  t.deepEqual(ret, expected)
})

test('should not touch arrays when casting', (t) => {
  const type = 'entry'
  const params = {
    query: { _id: { $in: ['entry:ent1', 'entry:ent2'] } },
  }
  const options = {
    collection: 'documents',
    db: 'database',
  }
  const expected = {
    type: 'entry',
    _id: { $in: ['entry:ent1', 'entry:ent2'] },
  }

  const ret = prepareFilter(options, type, undefined, params)

  t.deepEqual(ret, expected)
})
