import test from 'ava'

import getDocs from './getDocs'

test('should exist', (t) => {
  t.is(typeof getDocs, 'function')
})
