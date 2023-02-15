import test from 'ava'
import { TypedData } from 'integreat'
import { AggregationObject } from './types.js'

import createPaging from './createPaging.js'

// Setup

const prepareData = (data: TypedData[]) =>
  data.map((item) => ({ ...item, _id: `id_${item.id}` }))

// Tests

test('should return next: null when no data', (t) => {
  const data: TypedData[] = []
  const request = { type: 'entry', pageSize: 2 }
  const expected = { next: undefined }

  const ret = createPaging(data, request)

  t.deepEqual(ret, expected)
})

// Tests -- query

test('should return paging for first page', (t) => {
  const data = prepareData([
    { id: 'ent1', $type: 'entry' },
    { id: 'ent2', $type: 'entry' },
  ])
  const request = {
    type: 'entry',
    pageSize: 2,
    archived: true,
    target: 'crm',
  }
  const expected = {
    next: {
      type: 'entry',
      pageId: 'ZW50Mnw+', // ent2|>
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
    pageId: 'ZW50Mnw+', // ent2|>
    pageSize: 2,
  }
  const expected = {
    next: {
      type: 'entry',
      pageId: 'ZW50NHw+', // ent4|>
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
    pageId: 'ZW50Mnw+', // ent2|>
    pageSize: 2,
  }
  const expected = {
    next: undefined,
  }

  const ret = createPaging(data, request)

  t.deepEqual(ret, expected)
})

test('should return paging for first page - using pageOffset', (t) => {
  const data = prepareData([
    { id: 'ent1', $type: 'entry' },
    { id: 'ent2', $type: 'entry' },
  ])
  const request = {
    type: 'entry',
    pageOffset: 0,
    pageSize: 2,
    archived: true,
    target: 'crm',
  }
  const expected = {
    next: {
      type: 'entry',
      pageOffset: 2,
      pageSize: 2,
      archived: true,
    },
  }

  const ret = createPaging(data, request)

  t.deepEqual(ret, expected)
})

test('should return paging for second page - using pageOffset', (t) => {
  const data = prepareData([
    { id: 'ent3', $type: 'entry' },
    { id: 'ent4', $type: 'entry' },
  ])
  const request = {
    type: 'entry',
    pageOffset: 2,
    pageSize: 2,
  }
  const expected = {
    next: {
      type: 'entry',
      pageOffset: 4,
      pageSize: 2,
    },
  }

  const ret = createPaging(data, request)

  t.deepEqual(ret, expected)
})

test('should not return paging next when data size is smaller than page size - using pageOffset', (t) => {
  const data = prepareData([{ id: 'ent3', $type: 'entry' }])
  const request = {
    type: 'entry',
    pageOffset: 2,
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
      pageId: 'ZW50M3xpbmRleD4y', // ent3|index>2
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
      pageId: 'ZW50MnxpbmRleDwx', // ent2|index<1
      pageSize: 2,
    },
  }

  const ret = createPaging(data, request, sort)

  t.deepEqual(ret, expected)
})

test('should return paging with first sort field only', (t) => {
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
      pageId: 'ZW50MnxpbmRleDwx', // ent2|index<1
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
      pageId: 'ZW50M3xkYXRlPjIwMjEtMDEtMThUMTI6MDU6MTEuMDAwWg', // ent3|date>2021-01-18T12:05:11.000Z
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
      pageId: 'ZW50MnxtZXNzYWdlPCJFc2NhcGUlMjAlMjJtZSUyMiI', // ent2|message<"Escape%20%22me%22"
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
    archived: true,
    target: 'crm',
  }
  const expected = {
    next: {
      type: 'entry',
      id: 'ent1',
      pageId: 'ZW50Mnw+', // ent2|>
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
    query: [{ path: 'index', op: 'gt', value: 1 }],
    target: 'crm',
  }
  const expected = {
    next: {
      type: 'entry',
      query: [{ path: 'index', op: 'gt', value: 1 }],
      pageId: 'ZW50M3w+', // ent3|>
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

// Tests -- aggregation

test('should return paging for first page of aggregated data', (t) => {
  const data = [
    { _id: { account: 'acc1', id: 'proj1' }, amount: 35 },
    { _id: { account: 'acc1', id: 'proj2' }, amount: 2 },
  ]
  const request = {
    type: 'project',
    pageSize: 2,
    archived: true,
    target: 'crm',
  }
  const aggregation: AggregationObject[] = [
    {
      type: 'group',
      groupBy: ['account', 'id'],
      values: { amount: 'sum' },
    },
  ]
  const expected = {
    next: {
      type: 'project',
      pageId: 'YWNjb3VudHxhY2MxfGlkfHByb2oyfHw+', // account|acc1|id|proj2||>
      pageSize: 2,
      archived: true,
    },
  }

  const ret = createPaging(data, request, undefined, aggregation)

  t.deepEqual(ret, expected)
})

test('should return paging for the second page of aggregated data', (t) => {
  const data = [
    { _id: { account: 'acc2', id: 'proj1' }, amount: 72 },
    { _id: { account: 'acc3', id: 'proj1' }, amount: 14 },
  ]
  const request = {
    type: 'project',
    pageId: 'YWNjb3VudHxhY2MxfGlkfHByb2oyfHw+', // account|acc1|id|proj2||>
    pageSize: 2,
    archived: true,
  }
  const aggregation: AggregationObject[] = [
    {
      type: 'group',
      groupBy: ['account', 'id'],
      values: { amount: 'sum' },
    },
  ]
  const expected = {
    next: {
      type: 'project',
      pageId: 'YWNjb3VudHxhY2MzfGlkfHByb2oxfHw+', // account|acc3|id|proj1||>
      pageSize: 2,
      archived: true,
    },
  }

  const ret = createPaging(data, request, undefined, aggregation)

  t.deepEqual(ret, expected)
})

test('should not return paging when aggregated data size is smaller than page size', (t) => {
  const data = [{ _id: { account: 'acc3', id: 'proj2' }, amount: 4 }]
  const request = {
    type: 'project',
    pageId: 'YWNjb3VudHxhY2MzfGlkfHByb2oxfHw+', // account|acc3|id|proj1||>
    pageSize: 2,
    archived: true,
  }
  const aggregation: AggregationObject[] = [
    {
      type: 'group',
      groupBy: ['account', 'id'],
      values: { amount: 'sum' },
    },
  ]
  const expected = {
    next: undefined,
  }

  const ret = createPaging(data, request, undefined, aggregation)

  t.deepEqual(ret, expected)
})

test('should return paging for first page of aggregated data - using pageOffset', (t) => {
  // The `pageOffset` branch runs the same code as non-aggregation, so test only the first case
  const data = [
    { _id: { account: 'acc1', id: 'proj1' }, amount: 35 },
    { _id: { account: 'acc1', id: 'proj2' }, amount: 2 },
  ]
  const request = {
    type: 'project',
    pageOffset: 0,
    pageSize: 2,
    archived: true,
    target: 'crm',
  }
  const expected = {
    next: {
      type: 'project',
      pageOffset: 2,
      pageSize: 2,
      archived: true,
    },
  }

  const ret = createPaging(data, request)

  t.deepEqual(ret, expected)
})

test('should return paging for aggregated data when sorting', (t) => {
  const data = [
    { _id: { account: 'acc1', id: 'proj2' }, amount: 2 },
    { _id: { account: 'acc1', id: 'proj1' }, amount: 35 },
  ]
  const request = {
    type: 'project',
    pageSize: 2,
    archived: true,
    target: 'crm',
  }
  const aggregation: AggregationObject[] = [
    {
      type: 'group',
      groupBy: ['account', 'id'],
      values: { amount: 'sum' },
    },
    { type: 'sort', sortBy: { amount: 1 } },
  ]
  const expected = {
    next: {
      type: 'project',
      pageId: 'YWNjb3VudHxhY2MxfGlkfHByb2oxfHxhbW91bnQ+MzU', // account|acc1|id|proj1||amount>35
      pageSize: 2,
      archived: true,
    },
  }

  const ret = createPaging(data, request, undefined, aggregation)

  t.deepEqual(ret, expected)
})

test('should use default sorting when aggregated sorting is done before group', (t) => {
  const data = [
    { _id: { account: 'acc1', id: 'proj1' }, amount: 35 },
    { _id: { account: 'acc1', id: 'proj2' }, amount: 2 },
  ]
  const request = {
    type: 'project',
    pageSize: 2,
    archived: true,
    target: 'crm',
  }
  const aggregation: AggregationObject[] = [
    { type: 'sort', sortBy: { amount: 1 } },
    {
      type: 'group',
      groupBy: ['account', 'id'],
      values: { amount: 'sum' },
    },
  ]
  const expected = {
    next: {
      type: 'project',
      pageId: 'YWNjb3VudHxhY2MxfGlkfHByb2oyfHw+', // account|acc1|id|proj2||>
      pageSize: 2,
      archived: true,
    },
  }

  const ret = createPaging(data, request, undefined, aggregation)

  t.deepEqual(ret, expected)
})
