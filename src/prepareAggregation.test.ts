import test from 'ava'
import { AggregationObject } from './types'

import prepareAggregation from './prepareAggregation'

// Tests

test('should return mongo aggregation pipeline', (t) => {
  const aggregation = [
    { type: 'sort' as const, sortBy: { updatedAt: -1 as const } },
    {
      type: 'group' as const,
      groupBy: ['account', 'id'],
      values: { updatedAt: 'first' as const, status: 'first' as const },
    },
    {
      type: 'query' as const,
      query: [
        { path: 'type', param: 'type' },
        { path: 'personalia\\.age', op: 'gt', value: 18 },
      ],
    },
    { type: 'limit' as const, count: 1 },
    { type: 'unwind' as const, path: 'jobs' },
    { type: 'root' as const, path: 'jobs' },
  ]
  const expected = [
    { $sort: { updatedAt: -1 } },
    {
      $group: {
        _id: { account: '$account', id: '$id' },
        updatedAt: { $first: '$updatedAt' },
        status: { $first: '$status' },
      },
    },
    {
      $match: {
        '\\$type': 'entry',
        'personalia\\_age': { $gt: 18 },
      },
    },
    { $limit: 1 },
    {
      $unwind: {
        path: '$jobs',
        preserveNullAndEmptyArrays: false,
      },
    },
    { $replaceRoot: { newRoot: '$jobs' } },
  ]

  const ret = prepareAggregation(aggregation, { type: 'entry' })

  t.deepEqual(ret, expected)
})

test('should return mongo aggregation with lookup', (t) => {
  const aggregation = [
    {
      type: 'lookup' as const,
      collection: 'projects',
      field: 'included',
      variables: { ids: 'include' },
      pipeline: [
        {
          type: 'query' as const,
          query: [{ path: 'id', op: 'in' as const, expr: 'ids' }], // TODO
        },
        { type: 'sort' as const, sortBy: { updatedAt: -1 as const } },
        {
          type: 'group' as const,
          groupBy: ['id'],
          values: {
            jobs: { op: 'first' as const, path: 'definitions.jobs' },
          },
        },
      ],
    },
  ]
  const expected = [
    {
      $lookup: {
        from: 'projects',
        as: 'included',
        let: { ids: '$include' },
        pipeline: [
          {
            $match: { $expr: { $in: ['$id', '$$ids'] } },
          },
          { $sort: { updatedAt: -1 } },
          {
            $group: {
              _id: { id: '$id' },
              jobs: { $first: '$definitions.jobs' },
            },
          },
        ],
      },
    },
  ]

  const ret = prepareAggregation(aggregation, { type: 'entry' })

  t.deepEqual(ret, expected)
})

test('should return mongo aggregation with project', (t) => {
  const aggregation = [
    {
      type: 'project' as const,
      values: {
        jobs: {
          type: 'reduce' as const,
          path: 'included.jobs',
          initialPath: 'definitions.jobs',
          pipeline: { type: 'concatArrays' as const, path: ['value', 'this'] },
        },
      },
    },
  ]
  const expected = [
    {
      $project: {
        jobs: {
          $reduce: {
            input: '$included.jobs',
            initialValue: '$definitions.jobs',
            in: { $concatArrays: ['$$value', '$$this'] },
          },
        },
      },
    },
  ]

  const ret = prepareAggregation(aggregation, { type: 'entry' })

  t.deepEqual(ret, expected)
})

test('should escape paths used as props', (t) => {
  const aggregation = [
    { type: 'sort' as const, sortBy: { 'values.updatedAt': -1 as const } },
    {
      type: 'group' as const,
      groupBy: ['values.account', 'values.id'],
      values: {
        'values.updatedAt': 'first' as const,
        'values.status': 'first' as const,
      },
    },
    {
      type: 'query' as const,
      query: [
        { path: 'type', param: 'type' },
        { path: 'values.age', op: 'gt', value: 18 },
      ],
    },
  ]
  const expected = [
    { $sort: { 'values.updatedAt': -1 } },
    {
      $group: {
        _id: {
          'values\\\\_account': '$values.account',
          'values\\\\_id': '$values.id',
        },
        'values\\\\_updatedAt': { $first: '$values.updatedAt' },
        'values\\\\_status': { $first: '$values.status' },
      },
    },
    {
      $match: {
        '\\$type': 'entry',
        'values.age': { $gt: 18 },
      },
    },
  ]

  const ret = prepareAggregation(aggregation, { type: 'entry' })

  t.deepEqual(ret, expected)
})

test('should skip empty sort and query', (t) => {
  const aggregation = [
    { type: 'sort' as const, sortBy: {} },
    {
      type: 'group' as const,
      groupBy: ['account', 'id'],
      values: { updatedAt: 'first' as const, status: 'first' as const },
    },
    {
      type: 'query' as const,
      query: [],
    },
  ]
  const expected = [
    {
      $group: {
        _id: { account: '$account', id: '$id' },
        updatedAt: { $first: '$updatedAt' },
        status: { $first: '$status' },
      },
    },
  ]

  const ret = prepareAggregation(aggregation, { type: 'entry' })

  t.deepEqual(ret, expected)
})

test('should skip aggregation objects with missing properties', (t) => {
  const aggregation = [
    {
      type: 'query' as const,
      query: [{ path: 'something', value: 'otherthing' }],
    },
    { type: 'sort' as const },
    {
      type: 'group' as const,
    },
    {
      type: 'query' as const,
    },
  ] as AggregationObject[]
  const expected = [
    {
      $match: {
        something: 'otherthing',
      },
    },
  ]

  const ret = prepareAggregation(aggregation, { type: 'entry' })

  t.deepEqual(ret, expected)
})

test('should return undefined when entire pipeline is skipped', (t) => {
  const aggregation = [
    { type: 'sort' as const },
    {
      type: 'group' as const,
    },
    {
      type: 'query' as const,
    },
  ] as AggregationObject[]

  const ret = prepareAggregation(aggregation, { type: 'entry' })

  t.is(ret, undefined)
})

test('should return undefined when no aggregation', (t) => {
  const aggregation = undefined
  const expected = undefined

  const ret = prepareAggregation(aggregation)

  t.is(ret, expected)
})
