import test from 'ava'

import createPaging from './createPaging'

// Helpers

const prepareData = (data) => data.map((item) => ({...item, _id: `${item.type}:${item.id}`}))

// Tests

test('should return next: null when no data', (t) => {
  const data = []
  const params = {type: 'entry', pageSize: 2}
  const expected = {next: null}

  const ret = createPaging(data, params)

  t.deepEqual(ret, expected)
})

test('should return paging for first page', (t) => {
  const data = prepareData([{id: 'ent1', type: 'entry'}, {id: 'ent2', type: 'entry'}])
  const params = {
    type: 'entry',
    pageSize: 2
  }
  const expected = {
    next: {
      type: 'entry',
      query: {_id: {$gte: 'entry:ent2'}},
      pageAfter: 'entry:ent2',
      pageSize: 2
    }
  }

  const ret = createPaging(data, params)

  t.deepEqual(ret, expected)
})

test('should return paging for second page', (t) => {
  const data = prepareData([{id: 'ent3', type: 'entry'}, {id: 'ent4', type: 'entry'}])
  const params = {
    type: 'entry',
    query: {_id: {$gte: 'entry:ent2'}},
    pageAfter: 'entry:ent2',
    pageSize: 2
  }
  const expected = {
    next: {
      type: 'entry',
      query: {_id: {$gte: 'entry:ent4'}},
      pageAfter: 'entry:ent4',
      pageSize: 2
    }
  }

  const ret = createPaging(data, params)

  t.deepEqual(ret, expected)
})

test('should return paging when sorting', (t) => {
  const data = prepareData([
    {id: 'ent2', type: 'entry', attributes: {index: 1}},
    {id: 'ent3', type: 'entry', attributes: {index: 2}}
  ])
  const params = {
    type: 'entry',
    pageSize: 2
  }
  const sort = {
    'attributes.index': 1
  }
  const expected = {
    next: {
      type: 'entry',
      query: {'attributes.index': {$gte: 2}},
      pageAfter: 'entry:ent3',
      pageSize: 2
    }
  }

  const ret = createPaging(data, params, sort)

  t.deepEqual(ret, expected)
})

test('should return paging when sorting descending', (t) => {
  const data = prepareData([
    {id: 'ent3', type: 'entry', attributes: {index: 2}},
    {id: 'ent2', type: 'entry', attributes: {index: 1}}
  ])
  const params = {
    type: 'entry',
    pageSize: 2
  }
  const sort = {
    'attributes.index': -1
  }
  const expected = {
    next: {
      type: 'entry',
      query: {'attributes.index': {$lte: 1}},
      pageAfter: 'entry:ent2',
      pageSize: 2
    }
  }

  const ret = createPaging(data, params, sort)

  t.deepEqual(ret, expected)
})

test('should return paging when sorting ascending and descending', (t) => {
  const data = prepareData([
    {id: 'ent3', type: 'entry', attributes: {index: 2}},
    {id: 'ent2', type: 'entry', attributes: {index: 1}}
  ])
  const params = {
    type: 'entry',
    pageSize: 2
  }
  const sort = {
    'attributes.index': -1,
    id: 1
  }
  const expected = {
    next: {
      type: 'entry',
      query: {
        'attributes.index': {$lte: 1},
        id: {$gte: 'ent2'}
      },
      pageAfter: 'entry:ent2',
      pageSize: 2
    }
  }

  const ret = createPaging(data, params, sort)

  t.deepEqual(ret, expected)
})
