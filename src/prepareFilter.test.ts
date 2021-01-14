import test from 'ava'

import prepareFilter from './prepareFilter'

// Tests

test('should return type filter', (t) => {
  const type = 'entry'
  const query = undefined
  const expected = { '\\$type': 'entry' }

  const ret = prepareFilter(query, { type })

  t.deepEqual(ret, expected)
})

test('should return _id filter', (t) => {
  const type = 'entry'
  const id = 'ent1'
  const query = undefined
  const expected = { _id: 'entry:ent1' }

  const ret = prepareFilter(query, { type, id })

  t.deepEqual(ret, expected)
})

test('should use options.query as filter', (t) => {
  const type = 'entry'
  const id = 'ent1'
  const query = [
    { path: 'type', value: 'other' },
    { path: 'meta.parentType', param: 'type' },
    { path: 'meta.views', op: 'gt', value: 300 },
    { path: 'escaped\\.dot', value: true },
  ]
  const expected = {
    '\\$type': 'other',
    'meta.parentType': 'entry',
    'meta.views': { $gt: 300 },
    'escaped\\_dot': true,
  }

  const ret = prepareFilter(query, { type, id })

  t.deepEqual(ret, expected)
})

test('should add request query to options query filter', (t) => {
  const params = {
    type: 'entry',
    query: [
      { path: 'meta.section', value: 'news' },
      { path: 'meta.views', op: 'gt', value: 300 },
    ],
  }
  const query = [
    { path: 'type', value: 'other' },
    { path: 'meta\\.parentType', param: 'type' },
  ]
  const expected = {
    '\\$type': 'other',
    'meta\\_parentType': 'entry',
    'meta.section': 'news',
    'meta.views': { $gt: 300 },
  }

  const ret = prepareFilter(query, params)

  t.deepEqual(ret, expected)
})

test('should add request query object to options query filter', (t) => {
  const params = {
    type: 'entry',
    query: [
      { path: 'meta.section', value: 'news' },
      { path: 'meta.views', op: 'gt', value: 300 },
    ],
  }
  const query = [
    { path: 'type', value: 'other' },
    { path: 'meta\\.parentType', param: 'type' },
  ]
  const expected = {
    '\\$type': 'other',
    'meta\\_parentType': 'entry',
    'meta.section': 'news',
    'meta.views': { $gt: 300 },
  }

  const ret = prepareFilter(query, params)

  t.deepEqual(ret, expected)
})

test('should add request query to type filter', (t) => {
  const params = {
    type: 'entry',
    query: [{ path: 'meta.section', value: 'news' }],
  }
  const query = undefined
  const expected = {
    '\\$type': 'entry',
    'meta.section': 'news',
  }

  const ret = prepareFilter(query, params)

  t.deepEqual(ret, expected)
})

test('should add request query to id filter', (t) => {
  const params = {
    id: 'ent1',
    type: 'entry',
    query: [{ path: 'meta.section', value: 'news' }],
  }
  const query = undefined
  const expected = {
    _id: 'entry:ent1',
    'meta.section': 'news',
  }

  const ret = prepareFilter(query, params)

  t.deepEqual(ret, expected)
})

test('should skip query objects with non-primitive values', (t) => {
  const type = 'entry'
  const id = 'ent1'
  const query = [
    { path: 'meta.views', op: 'gt', value: 300 },
    { path: 'archived', value: true },
    { path: 'meta.author', op: 'in', value: ['johnf', 'lucyk'] },
    { path: 'meta.updatedAt', value: new Date('2017-11-13T18:43:01.000Z') },
    { path: 'meta.secret', value: { $exists: true } }, // Should skip this
  ]
  const expected = {
    'meta.views': { $gt: 300 },
    archived: true,
    'meta.author': { $in: ['johnf', 'lucyk'] },
    'meta.updatedAt': new Date('2017-11-13T18:43:01.000Z'),
  }

  const ret = prepareFilter(query, { type, id })

  t.deepEqual(ret, expected)
})

test('should accept queries with or logic', (t) => {
  const type = 'entry'
  const id = 'ent1'
  const query = [
    { path: 'meta.views', op: 'gt', value: 300 },
    [
      { path: 'meta.author', value: 'johnf' },
      { path: 'meta.author', value: 'lucyk' },
    ],
  ]
  const expected = {
    'meta.views': { $gt: 300 },
    $or: [{ 'meta.author': 'johnf' }, { 'meta.author': 'lucyk' }],
  }

  const ret = prepareFilter(query, { type, id })

  t.deepEqual(ret, expected)
})

test('should accept queries with and logic wihin or logic', (t) => {
  const type = 'entry'
  const id = 'ent1'
  const query = [
    { path: 'meta.views', op: 'gt', value: 300 },
    [
      { path: 'meta.author', value: 'johnf' },
      [
        { path: 'meta.author', value: 'lucyk' },
        { path: 'meta.views', op: 'gt', value: 500 },
      ],
    ],
  ]
  const expected = {
    'meta.views': { $gt: 300 },
    $or: [
      { 'meta.author': 'johnf' },
      { 'meta.author': 'lucyk', 'meta.views': { $gt: 500 } },
    ],
  }

  const ret = prepareFilter(query, { type, id })

  t.deepEqual(ret, expected)
})

test('should cast date strings as Date', (t) => {
  const params = {
    type: 'entry',
    query: [{ path: 'meta.updatedAt', value: '2017-11-13T18:43:01.000Z' }],
  }
  const query = undefined
  const expected = {
    '\\$type': 'entry',
    'meta.updatedAt': new Date('2017-11-13T18:43:01.000Z'),
  }

  const ret = prepareFilter(query, params)

  t.deepEqual(ret, expected)
})

test('should cast date strings without microseconds as Date', (t) => {
  const params = {
    type: 'entry',
    query: [{ path: 'meta.updatedAt', value: '2017-11-13T18:43:01Z' }],
  }
  const query = undefined
  const expected = {
    '\\$type': 'entry',
    'meta.updatedAt': new Date('2017-11-13T18:43:01Z'),
  }

  const ret = prepareFilter(query, params)

  t.deepEqual(ret, expected)
})

test('should cast date strings with other time zone as Date', (t) => {
  const params = {
    type: 'entry',
    query: [{ path: 'meta.updatedAt', value: '2017-11-13T18:43:01.000+01:00' }],
  }
  const query = undefined
  const expected = {
    '\\$type': 'entry',
    'meta.updatedAt': new Date('2017-11-13T18:43:01.000+01:00'),
  }

  const ret = prepareFilter(query, params)

  t.deepEqual(ret, expected)
})

test('should not touch Date object when casting', (t) => {
  const params = {
    type: 'entry',
    query: [
      { path: 'meta.updatedAt', value: new Date('2017-11-13T18:43:01.000Z') },
    ],
  }
  const query = undefined
  const expected = {
    '\\$type': 'entry',
    'meta.updatedAt': new Date('2017-11-13T18:43:01.000Z'),
  }

  const ret = prepareFilter(query, params)

  t.deepEqual(ret, expected)
})

test('should not touch arrays when casting', (t) => {
  const params = {
    type: 'entry',
    query: [{ path: '_id', op: 'in', value: ['entry:ent1', 'entry:ent2'] }],
  }
  const query = undefined
  const expected = {
    '\\$type': 'entry',
    _id: { $in: ['entry:ent1', 'entry:ent2'] },
  }

  const ret = prepareFilter(query, params)

  t.deepEqual(ret, expected)
})

test('should only allow certain query selectors', (t) => {
  const type = 'entry'
  const query = [
    { path: 'meta.section', value: 'news' }, // default: eq
    { path: 'meta.views', op: 'gt', value: 300 },
    { path: 'meta.views', op: 'lt', value: 1800 },
    { path: 'createdAt', op: 'gte', value: '2020-08-11T18:43:11Z' },
    { path: 'createdAt', op: 'lte', value: '2020-08-15T00:00:00Z' },
    { path: 'meta.author', op: 'in', value: ['johnf', 'lucyk'] },
    { path: 'title', op: 'text', value: 'search phrase' },
    { path: 'abstract', op: 'unknown', value: 'something odd' },
  ]
  const expected = {
    'meta.section': 'news',
    'meta.views': { $gt: 300, $lt: 1800 },
    createdAt: {
      $gte: new Date('2020-08-11T18:43:11Z'),
      $lte: new Date('2020-08-15T00:00:00Z'),
    },
    'meta.author': { $in: ['johnf', 'lucyk'] },
  }

  const ret = prepareFilter(query, { type })

  t.deepEqual(ret, expected)
})

test('should expand pageId to queries', (t) => {
  const query = [{ path: 'meta.views', op: 'gt', value: 300 }]
  const params = {
    type: 'entry',
    id: 'ent1',
    pageId: 'ZW50cnk6ZW50Mnw+', // entry:ent2|>
    query: [{ path: 'meta.section', value: 'news' }],
  }
  const expected = {
    'meta.views': { $gt: 300 },
    'meta.section': 'news',
    _id: { $gte: 'entry:ent2' },
  }

  const ret = prepareFilter(query, params)

  t.deepEqual(ret, expected)
})

test('should expand pageId with removed padding to queries', (t) => {
  const query = [{ path: 'meta.views', op: 'gt', value: 300 }]
  const params = {
    type: 'entry',
    id: 'ent1',
    pageId:
      'ZW50cnk6ZW50MnxhdHRyaWJ1dGVzLnRpbWVzdGFtcDwxNTg0MjExMzkxMDAwfGF0dHJpYnV0ZXMuaW5kZXg+MQ', // entry:ent2|attributes.timestamp<1584211391000|attributes.index>1
    query: [{ path: 'meta.section', value: 'news' }],
  }
  const expected = {
    'meta.views': { $gt: 300 },
    'meta.section': 'news',
    'attributes.timestamp': { $lte: 1584211391000 },
    'attributes.index': { $gte: 1 },
  }

  const ret = prepareFilter(query, params)

  t.deepEqual(ret, expected)
})

test('should expand pageId with sort filter to queries', (t) => {
  const query = [{ path: 'meta.views', op: 'gt', value: 300 }]
  const params = {
    type: 'entry',
    id: 'ent1',
    pageId: 'ZW50cnk6ZW50MnxpbmRleDwxfGlkPiJlbnQyIg', // entry:ent2|index<1|id>"ent2"
    query: [{ path: 'meta.section', value: 'news' }],
  }
  const expected = {
    'meta.views': { $gt: 300 },
    'meta.section': 'news',
    index: { $lte: 1 },
    id: { $gte: 'ent2' },
  }

  const ret = prepareFilter(query, params)

  t.deepEqual(ret, expected)
})

test('should expand pageId with encoded string', (t) => {
  const query = [{ path: 'meta.views', op: 'gt', value: 300 }]
  const params = {
    type: 'entry',
    id: 'ent1',
    pageId: 'ZW50cnk6ZW50MnxpbmRleDwxfG1lc3NhZ2U8IkVzY2FwZSUyMCUyMm1lJTIyIg', // entry:ent2|index<1|message<"Escape%20%22me%22"
    query: [{ path: 'meta.section', value: 'news' }],
  }
  const expected = {
    'meta.views': { $gt: 300 },
    'meta.section': 'news',
    index: { $lte: 1 },
    message: { $lte: 'Escape "me"' },
  }

  const ret = prepareFilter(query, params)

  t.deepEqual(ret, expected)
})

test('should expand pageId with unencoded string', (t) => {
  const query = [{ path: 'meta.views', op: 'gt', value: 300 }]
  const params = {
    type: 'entry',
    id: 'ent1',
    pageId: 'ZW50cnk6ZW50MnxpbmRleDwxfGlkPmVudDI', // entry:ent2|index<1|id>ent2
    query: [{ path: 'meta.section', value: 'news' }],
  }
  const expected = {
    'meta.views': { $gt: 300 },
    'meta.section': 'news',
    index: { $lte: 1 },
    id: { $gte: 'ent2' },
  }

  const ret = prepareFilter(query, params)

  t.deepEqual(ret, expected)
})
