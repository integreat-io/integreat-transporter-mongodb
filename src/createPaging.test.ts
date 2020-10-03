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
      query: { _id: { $gte: 'entry:ent2' } },
      pageAfter: 'entry:ent2',
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
    query: { _id: { $gte: 'entry:ent2' } },
    pageAfter: 'entry:ent2',
    pageSize: 2,
  }
  const expected = {
    next: {
      type: 'entry',
      query: { _id: { $gte: 'entry:ent4' } },
      pageAfter: 'entry:ent4',
      pageSize: 2,
    },
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
      query: { index: { $gte: 2 } },
      pageAfter: 'entry:ent3',
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
      query: { index: { $lte: 1 } },
      pageAfter: 'entry:ent2',
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
      query: {
        index: { $lte: 1 },
        id: { $gte: 'ent2' },
      },
      pageAfter: 'entry:ent2',
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
      query: { _id: { $gte: 'entry:ent2' } },
      pageAfter: 'entry:ent2',
      pageSize: 2,
      archived: true,
    },
  }

  const ret = createPaging(data, request)

  t.deepEqual(ret, expected)
})

test('should merge provided query param with _id query', (t) => {
  const data = prepareData([
    { id: 'ent2', $type: 'entry', index: 2 },
    { id: 'ent3', $type: 'entry', index: 3 },
  ])
  const request = {
    type: 'entry',
    pageSize: 2,
    params: { query: { index: { $gt: 1 } } },
    target: 'crm',
  }
  const expected = {
    next: {
      type: 'entry',
      query: { _id: { $gte: 'entry:ent3' }, index: { $gt: 1 } },
      pageAfter: 'entry:ent3',
      pageSize: 2,
    },
  }

  const ret = createPaging(data, request)

  t.deepEqual(ret, expected)
})

test('should merge provided query param with page query', (t) => {
  const data = prepareData([
    { id: 'ent2', $type: 'entry', index: 1 },
    { id: 'ent3', $type: 'entry', index: 2 },
  ])
  const request = {
    type: 'entry',
    pageSize: 2,
    params: { query: { id: { $lt: 'ent16' } } },
  }
  const sort = {
    index: 1,
  }
  const expected = {
    next: {
      type: 'entry',
      query: { id: { $lt: 'ent16' }, index: { $gte: 2 } },
      pageAfter: 'entry:ent3',
      pageSize: 2,
    },
  }

  const ret = createPaging(data, request, sort)

  t.deepEqual(ret, expected)
})

test('should combine provided query param with page query on same field', (t) => {
  const data = prepareData([
    { id: 'ent2', $type: 'entry', index: 1 },
    { id: 'ent3', $type: 'entry', index: 2 },
  ])
  const request = {
    type: 'entry',
    pageSize: 2,
    params: { query: { id: { $lt: 'ent16' }, index: { $lt: 5 } } },
  }
  const sort = {
    index: 1,
  }
  const expected = {
    next: {
      type: 'entry',
      query: { id: { $lt: 'ent16' }, index: { $gte: 2, $lt: 5 } },
      pageAfter: 'entry:ent3',
      pageSize: 2,
    },
  }

  const ret = createPaging(data, request, sort)

  t.deepEqual(ret, expected)
})

test('should combine provided query param with page query on same field and same selector', (t) => {
  const data = prepareData([
    { id: 'ent2', $type: 'entry', index: 1 },
    { id: 'ent3', $type: 'entry', index: 2 },
  ])
  const request = {
    type: 'entry',
    pageSize: 2,
    params: { query: { id: { $lt: 'ent16' }, index: { $gte: 0 } } },
  }
  const sort = {
    index: 1,
  }
  const expected = {
    next: {
      type: 'entry',
      query: { id: { $lt: 'ent16' }, index: { $gte: 2 } },
      pageAfter: 'entry:ent3',
      pageSize: 2,
    },
  }

  const ret = createPaging(data, request, sort)

  t.deepEqual(ret, expected)
})
