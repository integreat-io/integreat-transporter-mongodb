import test from 'ava'

import { encodePageId, decodePageId } from './pageId.js'
import type { AggregationObject } from '../types.js'

// Tests -- encode pageId

test('should encode pageId from lastItem', (t) => {
  const lastItem = { _id: 'internal1', id: 'ent2', $type: 'entry' }
  const expectedPageId = 'ImVudDIifD4' // "ent2"|>

  const ret = encodePageId(lastItem)

  t.is(ret, expectedPageId)
})

test('should encode pageId with sorting', (t) => {
  const lastItem = { id: 'ent3', $type: 'entry', index: 2 }
  const sort = { index: 1 }
  const expectedPageId = 'ImVudDMifGluZGV4PjI' // "ent3"|index>2

  const ret = encodePageId(lastItem, sort)

  t.is(ret, expectedPageId)
})

test('should encode pageId with descending sorting', (t) => {
  const lastItem = { id: 'ent3', $type: 'entry', index: 2 }
  const sort = { index: -1 }
  const expectedPageId = 'ImVudDMifGluZGV4PDI' // "ent3"|index<2

  const ret = encodePageId(lastItem, sort)

  t.is(ret, expectedPageId)
})

test('should encode pageId with sorting on a date field', (t) => {
  const lastItem = {
    id: 'ent3',
    $type: 'entry',
    date: new Date('2021-01-18T12:05:11Z'),
  }
  const sort = { date: 1 }
  const expectedPageId = 'ImVudDMifGRhdGU+MjAyMS0wMS0xOFQxMjowNToxMS4wMDBa' // "ent3"|date>2021-01-18T12:05:11.000Z

  const ret = encodePageId(lastItem, sort)

  t.is(ret, expectedPageId)
})

test('should encode pageId with encoded string', (t) => {
  const lastItem = { id: 'ent2', $type: 'entry', message: 'Escape "me"' }
  const sort = { message: -1 }
  const expectedPageId = 'ImVudDIifG1lc3NhZ2U8IkVzY2FwZSUyMCUyMm1lJTIyIg' // "ent2"|message<"Escape%20%22me%22"

  const ret = encodePageId(lastItem, sort)

  t.is(ret, expectedPageId)
})

test('should encode pageId for aggregated data', (t) => {
  const lastItem = { _id: { account: 'acc1', id: 'proj2' }, amount: 2 }
  const aggregation: AggregationObject[] = [
    {
      type: 'group',
      groupBy: ['account', 'id'],
      values: { amount: 'sum' },
    },
  ]
  const expectedPageId = 'fGFjY291bnR8ImFjYzEifGlkfCJwcm9qMiI' // |account|"acc1"|id|"proj2"

  const ret = encodePageId(lastItem, undefined, aggregation)

  t.is(ret, expectedPageId)
})

test('should encode pageId for aggregated data when sorting', (t) => {
  const lastItem = { _id: { account: 'acc1', id: 'proj1' }, amount: 35 }
  const aggregation: AggregationObject[] = [
    {
      type: 'group',
      groupBy: ['account', 'id'],
      values: { amount: 'sum' },
    },
    { type: 'sort', sortBy: { amount: 1 } },
  ]
  const expectedPageId = 'fGFjY291bnR8ImFjYzEifGlkfCJwcm9qMSI' // |account|"acc1"|id|"proj1"

  const ret = encodePageId(lastItem, undefined, aggregation)

  t.is(ret, expectedPageId)
})

test('should encode pageId for aggregated data when sorting by _id', (t) => {
  const lastItem = { _id: { account: 'acc1', id: 'proj1' }, amount: 35 }
  const aggregation: AggregationObject[] = [
    {
      type: 'group',
      groupBy: ['account', 'id'],
      values: { amount: 'sum' },
    },
    { type: 'sort', sortBy: { _id: 1 } },
  ]
  const expectedPageId = 'fGFjY291bnR8ImFjYzEifGlkfCJwcm9qMSI' // |account|"acc1"|id|"proj1"

  const ret = encodePageId(lastItem, undefined, aggregation)

  t.is(ret, expectedPageId)
})

test('should use default sorting when aggregated sorting is done before group', (t) => {
  const lastItem = { _id: { account: 'acc1', id: 'proj2' }, amount: 2 }
  const aggregation: AggregationObject[] = [
    { type: 'sort', sortBy: { amount: 1 } },
    {
      type: 'group',
      groupBy: ['account', 'id'],
      values: { amount: 'sum' },
    },
  ]
  const expectedPageId = 'fGFjY291bnR8ImFjYzEifGlkfCJwcm9qMiI' // |account|"acc1"|id|"proj2"

  const ret = encodePageId(lastItem, undefined, aggregation)

  t.is(ret, expectedPageId)
})

// Tests -- decode pageId

test('should decode pageId with default sorting', (t) => {
  const pageId = 'ImVudDIifD4=' // "ent2"|>
  const expected = {
    id: 'ent2',
    filter: [{ path: 'id', op: 'gte', value: 'ent2' }],
    isAgg: false,
  }

  const ret = decodePageId(pageId)

  t.deepEqual(ret, expected)
})

test('should decode pageId with numeric id', (t) => {
  const pageId = 'MTAwMXw+' // 1001|>
  const expected = {
    id: 1001,
    filter: [{ path: 'id', op: 'gte', value: 1001 }],
    isAgg: false,
  }

  const ret = decodePageId(pageId)

  t.deepEqual(ret, expected)
})

test('should decode pageId with sorting fields', (t) => {
  const pageId =
    'ImVudDIifGF0dHJpYnV0ZXMudGltZXN0YW1wPDE1ODQyMTEzOTEwMDB8YXR0cmlidXRlcy5pbmRleD4x' // "ent2"|attributes.timestamp<1584211391000|attributes.index>1
  const expected = {
    id: 'ent2',
    filter: [
      { path: 'attributes.timestamp', op: 'lte', value: 1584211391000 },
      { path: 'attributes.index', op: 'gte', value: 1 },
    ],
    isAgg: false,
  }

  const ret = decodePageId(pageId)

  t.deepEqual(ret, expected)
})

test('should decode pageId with encoded string', (t) => {
  const pageId = 'ImVudDIifGluZGV4PDF8bWVzc2FnZTwiRXNjYXBlJTIwJTIybWUlMjIi' // "ent2"|index<1|message<"Escape%20%22me%22"
  const expected = {
    id: 'ent2',
    filter: [
      { path: 'index', op: 'lte', value: 1 },
      { path: 'message', op: 'lte', value: 'Escape "me"' },
    ],
    isAgg: false,
  }

  const ret = decodePageId(pageId)

  t.deepEqual(ret, expected)
})

test('should decode pageId with unencoded string', (t) => {
  const pageId = 'ZW50MnxpbmRleDwxfGlkPmVudDI' // ent2|index<1|id>ent2
  const expected = {
    id: 'ent2',
    filter: [
      { path: 'index', op: 'lte', value: 1 },
      { path: 'id', op: 'gte', value: 'ent2' },
    ],
    isAgg: false,
  }

  const ret = decodePageId(pageId)

  t.deepEqual(ret, expected)
})

test('should decode pageId with date string', (t) => {
  const pageId = 'ImVudDMifGRhdGU+MjAyMS0wMS0xOFQxMjowNToxMS4wMDBa' // "ent3"|date>2021-01-18T12:05:11.000Z
  const expected = {
    id: 'ent3',
    filter: [{ path: 'date', op: 'gte', value: '2021-01-18T12:05:11.000Z' }],
    isAgg: false,
  }

  const ret = decodePageId(pageId)

  t.deepEqual(ret, expected)
})

test('should return undefined when no pageId', (t) => {
  t.is(decodePageId(undefined), undefined)
})

test('should decode pageId with compound id', (t) => {
  const pageId = 'fGFjY291bnR8ImFjYzEifGlkfCJwcm9qMiI' // |account|"acc1"|id|"proj2"
  const expected = {
    id: { account: 'acc1', id: 'proj2' },
    filter: [],
    isAgg: true,
  }

  const ret = decodePageId(pageId)

  t.deepEqual(ret, expected)
})
