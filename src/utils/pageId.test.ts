import test from 'ava'

import { decodePageId } from './pageId.js'

// Tests

test('should decode pageId with default sorting', (t) => {
  const pageId = 'ZW50Mnw+' // ent2|>
  const expected = {
    id: 'ent2',
    filter: [{ path: 'id', op: 'gte', value: 'ent2' }],
  }

  const ret = decodePageId(pageId)

  t.deepEqual(ret, expected)
})

test('should decode pageId with sorting fields, using only the first field as a filter', (t) => {
  const pageId =
    'ZW50MnxhdHRyaWJ1dGVzLnRpbWVzdGFtcDwxNTg0MjExMzkxMDAwfGF0dHJpYnV0ZXMuaW5kZXg+MQ' // ent2|attributes.timestamp<1584211391000|attributes.index>1
  const expected = {
    id: 'ent2',
    filter: [{ path: 'attributes.timestamp', op: 'lte', value: 1584211391000 }],
  }

  const ret = decodePageId(pageId)

  t.deepEqual(ret, expected)
})

test('should decode pageId with encoded string', (t) => {
  const pageId = 'ZW50MnxtZXNzYWdlPCJFc2NhcGUlMjAlMjJtZSUyMiI' // ent2|message<"Escape%20%22me%22"
  const expected = {
    id: 'ent2',
    filter: [{ path: 'message', op: 'lte', value: 'Escape "me"' }],
  }

  const ret = decodePageId(pageId)

  t.deepEqual(ret, expected)
})

test('should decode pageId with unencoded string', (t) => {
  const pageId = 'ZW50MnxpZD5lbnQy' // ent2|id>ent2
  const expected = {
    id: 'ent2',
    filter: [{ path: 'id', op: 'gte', value: 'ent2' }],
  }

  const ret = decodePageId(pageId)

  t.deepEqual(ret, expected)
})

test('should decode pageId with date string', (t) => {
  const pageId = 'ZW50M3xkYXRlPjIwMjEtMDEtMThUMTI6MDU6MTEuMDAwWg' // ent3|date>2021-01-18T12:05:11.000Z
  const expected = {
    id: 'ent3',
    filter: [{ path: 'date', op: 'gte', value: '2021-01-18T12:05:11.000Z' }],
  }

  const ret = decodePageId(pageId)

  t.deepEqual(ret, expected)
})

test('should decode pageId with aggregation id', (t) => {
  const pageId = 'YWNjb3VudHxhY2MxfGlkfHByb2oyfHw+' // account|acc1|id|proj2||>
  const expected = {
    id: { account: 'acc1', id: 'proj2' },
    filter: [
      { path: 'id', op: 'gte', value: { account: 'acc1', id: 'proj2' } },
    ],
  }

  const ret = decodePageId(pageId)

  t.deepEqual(ret, expected)
})

test('should decode pageId with aggregation id and sorting', (t) => {
  const pageId = 'YWNjb3VudHxhY2MxfGlkfHByb2oxfHxhbW91bnQ+MzU' // account|acc1|id|proj1||amount>35
  const expected = {
    id: { account: 'acc1', id: 'proj1' },
    filter: [{ path: 'amount', op: 'gte', value: 35 }],
  }

  const ret = decodePageId(pageId)

  t.deepEqual(ret, expected)
})

test('should return undefined when no pageId', (t) => {
  t.is(decodePageId(undefined), undefined)
})

test.todo('should be complete for different aggregation cases')
