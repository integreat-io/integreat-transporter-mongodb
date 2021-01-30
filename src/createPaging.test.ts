import test from 'ava'
import { TypedData } from 'integreat'

import createPaging from './createPaging'

// Helpers

const prepareData = (data: TypedData[]) =>
  data.map((item) => ({ ...item, _id: `${item.$type}:${item.id}` }))

// Tests

test('should return next: null when no data', (t) => {
  const data: TypedData[] = []
  const request = { type: 'entry', pageSize: 2 }
  const expected = { next: undefined }

  const ret = createPaging(data, request)

  t.deepEqual(ret, expected)
})

test('should return paging for first page', (t) => {
  const data = prepareData([
    { id: 'ent1', $type: 'entry' },
    { id: 'ent2', $type: 'entry' },
  ])
  const request = {
    type: 'entry',
    pageSize: 2,
    params: { archived: true },
    target: 'crm',
  }
  const expected = {
    next: {
      type: 'entry',
      pageId: 'ZW50cnk6ZW50Mnw+', // entry:ent2|>
      pageSize: 2,
      archived: true,
    },
  }

  const ret = createPaging(data, request)

  t.deepEqual(ret, expected)
})

test('should return paging for second page', (t) => {
  const data = prepareData([
    { id: 'ent3', $type: 'entry' },
    { id: 'ent4', $type: 'entry' },
  ])
  const request = {
    type: 'entry',
    pageId: 'ZW50cnk6ZW50NHw+', // entry:ent2|>
    pageSize: 2,
  }
  const expected = {
    next: {
      type: 'entry',
      pageId: 'ZW50cnk6ZW50NHw+', // entry:ent4|>
      pageSize: 2,
    },
  }

  const ret = createPaging(data, request)

  t.deepEqual(ret, expected)
})

test('should not return paging next when data size is smaller than page size', (t) => {
  const data = prepareData([{ id: 'ent3', $type: 'entry' }])
  const request = {
    type: 'entry',
    pageId: 'ZW50cnk6ZW50NHw+', // entry:ent2|>
    pageSize: 2,
  }
  const expected = {
    next: undefined,
  }

  const ret = createPaging(data, request)

  t.deepEqual(ret, expected)
})

test('should not return paging next when no page size', (t) => {
  const data = prepareData([{ id: 'ent3', $type: 'entry' }])
  const request = {
    type: 'entry',
  }
  const expected = {
    next: undefined,
  }

  const ret = createPaging(data, request)

  t.deepEqual(ret, expected)
})

test('should return paging when sorting', (t) => {
  const data = prepareData([
    { id: 'ent2', $type: 'entry', index: 1 },
    { id: 'ent3', $type: 'entry', index: 2 },
  ])
  const request = {
    type: 'entry',
    pageSize: 2,
  }
  const sort = {
    index: 1,
  }
  const expected = {
    next: {
      type: 'entry',
      pageId: 'ZW50cnk6ZW50M3xpbmRleD4y', // entry:ent3|index>2
      pageSize: 2,
    },
  }

  const ret = createPaging(data, request, sort)

  t.deepEqual(ret, expected)
})

test('should return paging when sorting descending', (t) => {
  const data = prepareData([
    { id: 'ent3', $type: 'entry', index: 2 },
    { id: 'ent2', $type: 'entry', index: 1 },
  ])
  const request = {
    type: 'entry',
    pageSize: 2,
  }
  const sort = {
    index: -1,
  }
  const expected = {
    next: {
      type: 'entry',
      pageId: 'ZW50cnk6ZW50MnxpbmRleDwx', //entry:ent2|index<1
      pageSize: 2,
    },
  }

  const ret = createPaging(data, request, sort)

  t.deepEqual(ret, expected)
})

test('should return paging when sorting ascending and descending', (t) => {
  const data = prepareData([
    { id: 'ent3', $type: 'entry', index: 2 },
    { id: 'ent2', $type: 'entry', index: 1 },
  ])
  const request = {
    type: 'entry',
    pageSize: 2,
  }
  const sort = {
    index: -1,
    id: 1,
  }
  const expected = {
    next: {
      type: 'entry',
      pageId: 'ZW50cnk6ZW50MnxpbmRleDwxfGlkPiJlbnQyIg', // entry:ent2|index<1|id>"ent2"
      pageSize: 2,
    },
  }

  const ret = createPaging(data, request, sort)

  t.deepEqual(ret, expected)
})

test('should return paging when sorting on a date field', (t) => {
  const data = prepareData([
    { id: 'ent2', $type: 'entry', date: new Date('2021-01-18T10:44:39Z') },
    { id: 'ent3', $type: 'entry', date: new Date('2021-01-18T12:05:11Z') },
  ])
  const request = {
    type: 'entry',
    pageSize: 2,
  }
  const sort = {
    date: 1,
  }
  const expected = {
    next: {
      type: 'entry',
      pageId: 'ZW50cnk6ZW50M3xkYXRlPjE2MTA5NzE1MTEwMDA', // entry:ent3|date>1610971511000
      pageSize: 2,
    },
  }

  const ret = createPaging(data, request, sort)

  t.deepEqual(ret, expected)
})

test('should return paging with encoded string', (t) => {
  const data = prepareData([
    { id: 'ent3', $type: 'entry', message: 'I will not be included' },
    { id: 'ent2', $type: 'entry', message: 'Escape "me"' },
  ])
  const request = {
    type: 'entry',
    pageSize: 2,
  }
  const sort = {
    message: -1,
  }
  const expected = {
    next: {
      type: 'entry',
      pageId: 'ZW50cnk6ZW50MnxtZXNzYWdlPCJFc2NhcGUlMjAlMjJtZSUyMiI', // entry:ent2|message<"Escape%20%22me%22"
      pageSize: 2,
    },
  }

  const ret = createPaging(data, request, sort)

  t.deepEqual(ret, expected)
})

test('should include id and other params when present in request', (t) => {
  const data = prepareData([
    { id: 'ent1', $type: 'entry' },
    { id: 'ent2', $type: 'entry' },
  ])
  const request = {
    type: 'entry',
    id: 'ent1',
    pageSize: 2,
    params: { archived: true },
    target: 'crm',
  }
  const expected = {
    next: {
      type: 'entry',
      id: 'ent1',
      pageId: 'ZW50cnk6ZW50Mnw+', // entry:ent2|>
      pageSize: 2,
      archived: true,
    },
  }

  const ret = createPaging(data, request)

  t.deepEqual(ret, expected)
})

test('should not touch existing query', (t) => {
  const data = prepareData([
    { id: 'ent2', $type: 'entry', index: 2 },
    { id: 'ent3', $type: 'entry', index: 3 },
  ])
  const request = {
    type: 'entry',
    pageSize: 2,
    params: { query: [{ path: 'index', op: 'gt', value: 1 }] },
    target: 'crm',
  }
  const expected = {
    next: {
      type: 'entry',
      query: [{ path: 'index', op: 'gt', value: 1 }],
      pageId: 'ZW50cnk6ZW50M3w+', // entry:ent3|>
      pageSize: 2,
    },
  }

  const ret = createPaging(data, request)

  t.deepEqual(ret, expected)
})

test('should not touch when not typed data', (t) => {
  const data = [
    { accountId: '1505', amount: 159 },
    { accountId: '1506', amount: 209 },
  ]
  const request = {
    type: 'entry',
    pageSize: 2,
    params: {},
    target: 'crm',
  }
  const expected = {
    next: {
      type: 'entry',
      pageId: undefined,
      pageSize: 2,
    },
  }

  const ret = createPaging(data, request)

  t.deepEqual(ret, expected)
})
