import test from 'ava'

import { serializeItem, normalizeItem, serializePath } from './escapeKeys.js'

test('should escape reserved characters on serialization', (t) => {
  const data = {
    id: 'ent1',
    $type: 'entry',
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
  }
  const expected = {
    id: 'ent1',
    '\\$type': 'entry',
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
  }

  const ret = serializeItem(data)

  t.deepEqual(ret, expected)
})

test('should remove escape characters on normalization', (t) => {
  const data = {
    id: 'ent1',
    '\\$type': 'entry',
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
  }
  const expected = {
    id: 'ent1',
    $type: 'entry',
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
    'field\\.with\\.several\\.dots'
  )
})

test('should no escape dots followed by dollar in paths', (t) => {
  t.is(serializePath('meta.views.$gt'), 'meta\\.views.$gt')
})

test('should escape escaped dots in paths', (t) => {
  t.is(
    serializePath('field\\.with.several\\.dots'),
    'field\\_with\\.several\\_dots'
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
