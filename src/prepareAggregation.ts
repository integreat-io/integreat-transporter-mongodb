import {
  GroupMethod,
  GroupObject,
  AggregationObject,
  AggregationObjectGroup,
  AggregationObjectSort,
  AggregationObjectQuery,
  AggregationObjectReduce,
  AggregationObjectLimit,
  AggregationObjectUnwind,
  AggregationObjectRoot,
  AggregationObjectLookUp,
  AggregationObjectProject,
  AggregationObjectConcatArrays,
  AggregationObjectIf,
} from './types.js'
import { isObject, isNotEmpty } from './utils/is.js'
import { ensureArray, dearrayIfPossible } from './utils/array.js'
import prepareFilter from './prepareFilter.js'

export interface Aggregation extends Record<string, unknown> {
  $sort?: unknown
  $group?: unknown
  $reduce?: unknown
  $project?: unknown
  $unwind?: unknown
  $root?: unknown
}

const isSortAggregation = (aggregation: Aggregation) => !!aggregation.$sort
const isRegroupingAggregation = (aggregation: Aggregation) =>
  !!aggregation.$group

const isAggregationObject = (expr: unknown): expr is AggregationObject =>
  isObject(expr) && typeof expr.type === 'string'

const isAggregation = (
  expr: unknown
): expr is AggregationObject | AggregationObject[] =>
  (Array.isArray(expr) && isAggregationObject(expr[0])) ||
  isAggregationObject(expr)

const serializeFieldKey = (key: string) => key.replace('.', '\\\\_')

const prepareGroupId = (fields: string[]) =>
  fields.reduce(
    (obj, field) => ({ ...obj, [serializeFieldKey(field)]: `$${field}` }),
    {}
  )

const createFieldObject = (
  field: string,
  method: GroupMethod | GroupObject
) => ({ [`$${method}`]: `$${field}` })

const prepareGroupFields = (
  fields: Record<string, GroupMethod | GroupObject>
) =>
  Object.entries(fields).reduce(
    (obj, [field, method]) => ({
      ...obj,
      [serializeFieldKey(field)]:
        typeof method === 'string'
          ? createFieldObject(field, method)
          : createFieldObject(method.path, method.op),
    }),
    {}
  )

const groupToMongo = ({ groupBy, values }: AggregationObjectGroup) =>
  isObject(values)
    ? {
        $group: {
          _id: prepareGroupId(groupBy),
          ...prepareGroupFields(values),
        },
      }
    : undefined

const sortToMongo = ({ sortBy }: AggregationObjectSort) =>
  isObject(sortBy) && Object.keys(sortBy).length > 0
    ? { $sort: sortBy }
    : undefined

const queryToMongo = (
  { query }: AggregationObjectQuery,
  params: Record<string, unknown>
) =>
  Array.isArray(query) && query.length > 0
    ? {
        $match: prepareFilter(query, params),
      }
    : undefined

const reduceToMongo = (
  { path, initialPath, pipeline }: AggregationObjectReduce,
  params: Record<string, unknown>
) => ({
  $reduce: {
    input: `$${path}`,
    initialValue:
      typeof initialPath === 'string'
        ? `$${initialPath}`
        : dearrayIfPossible(
            prepareAggregation(ensureArray(initialPath), params)
          ),
    in: dearrayIfPossible(prepareAggregation(ensureArray(pipeline), params)),
  },
})

const expressionToMongo = (
  expr: AggregationObject | AggregationObject[] | unknown,
  params: Record<string, unknown>
) =>
  typeof expr === 'string'
    ? `$${expr}`
    : isAggregation(expr)
    ? dearrayIfPossible(prepareAggregation(ensureArray(expr), params))
    : expr

const ifToMongo = (
  { condition, then: thenArg, else: elseArg }: AggregationObjectIf,
  params: Record<string, unknown>
) => ({
  $cond: {
    if: dearrayIfPossible(prepareFilter(ensureArray(condition), params)),
    then: expressionToMongo(thenArg, params),
    else: expressionToMongo(elseArg, params),
  },
})

const prepareLookupValues = (variables: Record<string, string>) =>
  Object.entries(variables).reduce(
    (obj, [key, value]) => ({ ...obj, [key]: `$${value}` }),
    {}
  )

const lookupToMongo = (
  {
    collection,
    field,
    path,
    setPath,
    variables,
    pipeline,
  }: AggregationObjectLookUp,
  params: Record<string, unknown>
) => ({
  $lookup: {
    from: collection,
    foreignField: field,
    localField: path,
    as: setPath ?? path,
    ...(variables && {
      let: prepareLookupValues(variables),
    }),
    ...(pipeline && {
      pipeline: dearrayIfPossible(
        prepareAggregation(ensureArray(pipeline), params)
      ),
    }),
  },
})

const projectToMongo = (
  { values }: AggregationObjectProject,
  params: Record<string, unknown>
) => ({
  $project: Object.fromEntries(
    Object.entries(values).map(([key, value]) => [
      key,
      dearrayIfPossible(prepareAggregation(ensureArray(value), params)),
    ])
  ),
})

const limitToMongo = ({ count }: AggregationObjectLimit) => ({ $limit: count })

const unwindToMongo = ({ path }: AggregationObjectUnwind) => ({
  $unwind: { path: `$${path}`, preserveNullAndEmptyArrays: false },
})

const rootToMongo = ({ path }: AggregationObjectRoot) => ({
  $replaceRoot: { newRoot: `$${path}` },
})

const concatArraysToMongo = ({ path }: AggregationObjectConcatArrays) => ({
  $concatArrays: path.map((p) => `$$${p}`),
})

const toMongo = (params: Record<string, unknown>) =>
  function toMongo(obj: AggregationObject) {
    switch (obj.type) {
      case 'group':
        return groupToMongo(obj)
      case 'sort':
        return sortToMongo(obj)
      case 'query':
        return queryToMongo(obj, params)
      case 'reduce':
        return reduceToMongo(obj, params)
      case 'if':
        return ifToMongo(obj, params)
      case 'lookup':
        return lookupToMongo(obj, params)
      case 'project':
        return projectToMongo(obj, params)
      case 'limit':
        return limitToMongo(obj)
      case 'unwind':
        return unwindToMongo(obj)
      case 'root':
        return rootToMongo(obj)
      case 'concatArrays':
        return concatArraysToMongo(obj)
      default:
        return undefined
    }
  }

function ensureSorting(pipeline: Aggregation[]) {
  const sortIndex = pipeline.findLastIndex(isSortAggregation)
  const regroupIndex = pipeline.findLastIndex(isRegroupingAggregation)
  return sortIndex > regroupIndex
    ? pipeline
    : [...pipeline, { $sort: { _id: 1 } }]
}

export default function prepareAggregation(
  aggregation?: AggregationObject[],
  params: Record<string, unknown> = {},
  addDefaultSorting = false
): Aggregation[] | undefined {
  if (!Array.isArray(aggregation) || aggregation.length === 0) {
    return undefined
  }

  const pipeline = aggregation.map(toMongo(params)).filter(isNotEmpty)
  return pipeline.length > 0
    ? addDefaultSorting
      ? ensureSorting(pipeline)
      : pipeline
    : undefined
}
