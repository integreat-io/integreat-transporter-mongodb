import test from 'ava'

import wrapper from './wrapper'

test('should exist', (t) => {
  t.is(typeof wrapper, 'function')
})

test('should set mongodb adapter', (t) => {
  const resources = {}

  const ret = wrapper(resources)

  t.truthy(ret.adapters)
  t.truthy(ret.adapters.mongodb)
  t.is(typeof ret.adapters.mongodb.send, 'function')
})

test('should leave existing resources untouched', (t) => {
  const resources = {
    adapters: { json: {} },
    formatters: {}
  }

  const ret = wrapper(resources)

  t.truthy(ret.formatters)
  t.truthy(ret.adapters.json)
})
