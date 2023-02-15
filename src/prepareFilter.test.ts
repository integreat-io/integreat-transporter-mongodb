import test from 'ava'
import { decodePageId } from './utils/pageId.js'

import prepareFilter from './prepareFilter.js'

// Tests

test('should return no filter when no query or no id is specified', (t) => {
  const type = 'entry'
  const query = undefined
  const expected = {}

  const ret = prepareFilter(query, { type })

  t.deepEqual(ret, expected)
})

test('should return id filter', (t) => {
  const type = 'entry'
  const id = 'ent1'
  const query = undefined
  const expected = { id: 'ent1' }

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
    { path: 'completedAt', op: 'notset' },
    { path: 'updatedAt', op: 'isset' },
    { path: 'escaped\\.dot', value: true },
    { path: 'id', op: 'regex', value: '.+:lastUpdated$' },
    { path: 'topic', op: 'in', value: ['news', 'sports'] },
    { path: 'status', op: 'in', variable: 'statuslist' },
    { path: 'jobs', op: 'isArray' },
  ]
  const expected = {
    type: 'other',
    'meta.parentType': 'entry',
    'meta.views': { $gt: 300 },
    completedAt: { $eq: null },
    updatedAt: { $ne: null },
    'escaped\\_dot': true,
    id: { $regex: '.+:lastUpdated$' },
    topic: { $in: ['news', 'sports'] },
    status: { $in: '$$statuslist' },
    $isArray: '$jobs',
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
    type: 'other',
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
    type: 'other',
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
    id: 'ent1',
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

test('should support expr queries for in', (t) => {
  const type = 'entry'
  const id = 'ent1'
  const query = [{ path: 'id', op: 'in', variable: 'ids', expr: true }]
  const expected = {
    $expr: { $in: ['$id', '$$ids'] },
  }

  const ret = prepareFilter(query, { type, id })

  t.deepEqual(ret, expected)
})

test('should support expr queries for isArray', (t) => {
  const type = 'entry'
  const id = 'ent1'
  const query = [{ path: 'jobs', op: 'isArray', expr: true }]
  const expected = {
    $expr: { $isArray: '$jobs' },
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
    'meta.updatedAt': new Date('2017-11-13T18:43:01.000Z'),
  }

  const ret = prepareFilter(query, params)

  t.deepEqual(ret, expected)
})

test('should not touch arrays when casting', (t) => {
  const params = {
    type: 'entry',
    query: [{ path: '_id', op: 'in', value: ['ent1', 'ent2'] }],
  }
  const query = undefined
  const expected = {
    _id: { $in: ['ent1', 'ent2'] },
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
    pageId: 'ZW50Mnw+', // ent2|>
    query: [{ path: 'meta.section', value: 'news' }],
  }
  const pageId = decodePageId('ZW50Mnw+')
  const expected = {
    'meta.views': { $gt: 300 },
    'meta.section': 'news',
    id: { $gte: 'ent2' },
  }

  const ret = prepareFilter(query, params, pageId)

  t.deepEqual(ret, expected)
})

test('should expand pageId with removed padding to queries', (t) => {
  const query = [{ path: 'meta.views', op: 'gt', value: 300 }]
  const params = {
    type: 'entry',
    id: 'ent1',
    pageId:
      'ZW50MnxhdHRyaWJ1dGVzLnRpbWVzdGFtcDwxNTg0MjExMzkxMDAwfGF0dHJpYnV0ZXMuaW5kZXg+MQ', // ent2|attributes.timestamp<1584211391000|attributes.index>1
    query: [{ path: 'meta.section', value: 'news' }],
  }
  const pageId = decodePageId(
    'ZW50MnxhdHRyaWJ1dGVzLnRpbWVzdGFtcDwxNTg0MjExMzkxMDAwfGF0dHJpYnV0ZXMuaW5kZXg+MQ'
  )
  const expected = {
    'meta.views': { $gt: 300 },
    'meta.section': 'news',
    'attributes.timestamp': { $lte: 1584211391000 },
    'attributes.index': { $gte: 1 },
  }

  const ret = prepareFilter(query, params, pageId)

  t.deepEqual(ret, expected)
})

test('should expand pageId with sort filter to queries', (t) => {
  const query = [{ path: 'meta.views', op: 'gt', value: 300 }]
  const params = {
    type: 'entry',
    id: 'ent1',
    pageId: 'ZW50MnxpbmRleDwxfGlkPiJlbnQyIg', // ent2|index<1|id>"ent2"
    query: [{ path: 'meta.section', value: 'news' }],
  }
  const pageId = decodePageId('ZW50MnxpbmRleDwxfGlkPiJlbnQyIg')
  const expected = {
    'meta.views': { $gt: 300 },
    'meta.section': 'news',
    index: { $lte: 1 },
    id: { $gte: 'ent2' },
  }

  const ret = prepareFilter(query, params, pageId)

  t.deepEqual(ret, expected)
})

test('should expand pageId with encoded string', (t) => {
  const query = [{ path: 'meta.views', op: 'gt', value: 300 }]
  const params = {
    type: 'entry',
    id: 'ent1',
    pageId: 'ZW50MnxpbmRleDwxfG1lc3NhZ2U8IkVzY2FwZSUyMCUyMm1lJTIyIg', // ent2|index<1|message<"Escape%20%22me%22"
    query: [{ path: 'meta.section', value: 'news' }],
  }
  const pageId = decodePageId(
    'ZW50MnxpbmRleDwxfG1lc3NhZ2U8IkVzY2FwZSUyMCUyMm1lJTIyIg'
  )
  const expected = {
    'meta.views': { $gt: 300 },
    'meta.section': 'news',
    index: { $lte: 1 },
    message: { $lte: 'Escape "me"' },
  }

  const ret = prepareFilter(query, params, pageId)

  t.deepEqual(ret, expected)
})

test('should expand pageId with unencoded string', (t) => {
  const query = [{ path: 'meta.views', op: 'gt', value: 300 }]
  const params = {
    type: 'entry',
    id: 'ent1',
    pageId: 'ZW50MnxpbmRleDwxfGlkPmVudDI', // ent2|index<1|id>ent2
    query: [{ path: 'meta.section', value: 'news' }],
  }
  const pageId = decodePageId('ZW50MnxpbmRleDwxfGlkPmVudDI')
  const expected = {
    'meta.views': { $gt: 300 },
    'meta.section': 'news',
    index: { $lte: 1 },
    id: { $gte: 'ent2' },
  }

  const ret = prepareFilter(query, params, pageId)

  t.deepEqual(ret, expected)
})

test('should expand pageId with date string', (t) => {
  const query = [{ path: 'meta.views', op: 'gt', value: 300 }]
  const params = {
    type: 'entry',
    id: 'ent1',
    pageId: 'ZW50M3xkYXRlPjIwMjEtMDEtMThUMTI6MDU6MTEuMDAwWg', // ent3|date>2021-01-18T12:05:11.000Z
    query: [{ path: 'meta.section', value: 'news' }],
  }
  const pageId = decodePageId('ZW50M3xkYXRlPjIwMjEtMDEtMThUMTI6MDU6MTEuMDAwWg')
  const expected = {
    'meta.views': { $gt: 300 },
    'meta.section': 'news',
    date: { $gte: new Date('2021-01-18T12:05:11.000Z') },
  }

  const ret = prepareFilter(query, params, pageId)

  t.deepEqual(ret, expected)
})
