import test from 'ava'

import { serializeItem, normalizeItem, serializePath } from './serialize.js'

test('should escape reserved characters and remove undefined values on serialization', (t) => {
  const data = {
    '.': 'data',
    id: 'ent1',
    $type: 'entry',
    '\\$type': 'Escaped',
    'stats.count': 3,
    channel$: 'news',
    title: undefined,
    entry_author: {
      id: 'johnf',
      $type: 'author',
      'authored\\.entries': ['ent1', 'ent3', undefined],
      name: undefined,
    },
    items: [
      {
        $iterate: true,
      },
    ],
    'field.with.several.dots': false,
    'escaped\\_underscore': 'why?',
    '': 'Empty',
  }
  const expected = {
    '\\_': 'data',
    id: 'ent1',
    '\\$type': 'entry',
    '\\\\$type': 'Escaped',
    'stats\\_count': 3,
    channel$: 'news',
    entry_author: {
      id: 'johnf',
      '\\$type': 'author',
      'authored\\\\\\_entries': ['ent1', 'ent3', undefined],
    },
    items: [
      {
        '\\$iterate': true,
      },
    ],
    'field\\_with\\_several\\_dots': false,
    'escaped\\\\_underscore': 'why?',
    '**empty**': 'Empty',
  }

  const ret = serializeItem(data)

  t.deepEqual(ret, expected)
})

test('should handle special $inc object', (t) => {
  const data = {
    id: 'ent1',
    author: { id: 'johnf' },
    count: { $inc: 2 },
  }
  const expected = {
    id: 'ent1',
    author: { id: 'johnf' },
    $inc: { count: 2 },
  }

  const ret = serializeItem(data)

  t.deepEqual(ret, expected)
})

test('should join several $inc objects', (t) => {
  const data = {
    id: 'ent1',
    author: { id: 'johnf' },
    count: { $inc: 2 },
    sum: { $inc: 100 },
  }
  const expected = {
    id: 'ent1',
    author: { id: 'johnf' },
    $inc: { count: 2, sum: 100 },
  }

  const ret = serializeItem(data)

  t.deepEqual(ret, expected)
})

test('should keep undefined values on serialization when keepUndefined is true', (t) => {
  const keepUndefined = true
  const data = {
    id: 'ent1',
    $type: 'entry',
    title: undefined,
    entry_author: {
      id: 'johnf',
      $type: 'author',
      'authored\\.entries': ['ent1', 'ent3', undefined],
      name: undefined,
    },
  }
  const expected = {
    id: 'ent1',
    '\\$type': 'entry',
    title: undefined,
    entry_author: {
      id: 'johnf',
      '\\$type': 'author',
      'authored\\\\\\_entries': ['ent1', 'ent3', undefined],
      name: undefined,
    },
  }

  const ret = serializeItem(data, keepUndefined)

  t.deepEqual(ret, expected)
})

test('should remove escape characters on normalization', (t) => {
  const data = {
    '\\_': 'data',
    id: 'ent1',
    '\\$type': 'entry',
    '\\\\$type': 'Escaped',
    'stats\\_count': 3,
    channel$: 'news',
    entry_author: {
      id: 'johnf',
      '\\$type': 'author',
      'authored\\\\\\_entries': ['ent1', 'ent3'],
    },
    items: [
      {
        '\\$iterate': true,
      },
    ],
    'field\\_with\\_several\\_dots': false,
    'escaped\\\\_underscore': 'why?',
    '**empty**': 'Empty',
  }
  const expected = {
    '.': 'data',
    id: 'ent1',
    $type: 'entry',
    '\\$type': 'Escaped',
    'stats.count': 3,
    channel$: 'news',
    entry_author: {
      id: 'johnf',
      $type: 'author',
      'authored\\.entries': ['ent1', 'ent3'],
    },
    items: [
      {
        $iterate: true,
      },
    ],
    'field.with.several.dots': false,
    'escaped\\_underscore': 'why?',
    '': 'Empty',
  }

  const ret = normalizeItem(data)

  t.deepEqual(ret, expected)
})

test('should escape dollers in the beginning of a path', (t) => {
  t.is(serializePath('$type'), '\\$type')
  t.is(serializePath('channel$'), 'channel$')
})

test('should escape the escape character in path', (t) => {
  t.is(serializePath('escaped\\_underscore'), 'escaped\\\\_underscore')
})

test('should escape dots in paths', (t) => {
  t.is(
    serializePath('field.with.several.dots'),
    'field\\.with\\.several\\.dots',
  )
})

test('should no escape dots followed by dollar in paths', (t) => {
  t.is(serializePath('meta.views.$gt'), 'meta\\.views.$gt')
})

test('should escape escaped dots in paths', (t) => {
  t.is(
    serializePath('field\\.with.several\\.dots'),
    'field\\_with\\.several\\_dots',
  )
})

test('should remove reserved property __totalCount', (t) => {
  const data = {
    id: 'ent1',
    type: 'entry',
    __totalCount: 3,
  }
  const expected = {
    id: 'ent1',
    type: 'entry',
  }

  const ret = normalizeItem(data)

  t.deepEqual(ret, expected)
})
