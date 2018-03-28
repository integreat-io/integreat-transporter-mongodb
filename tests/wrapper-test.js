import test from 'ava'

import mongodb from '..'

test('should wrap resources', (t) => {
  const resources = {
    adapters: {json: {}},
    formatters: {}
  }

  const ret = mongodb(resources)

  t.truthy(ret.adapters.mongodb)
  t.truthy(ret.adapters.json)
  t.truthy(ret.formatters)
})
