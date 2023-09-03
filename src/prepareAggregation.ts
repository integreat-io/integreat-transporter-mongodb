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
  expr: unknown,
): expr is AggregationObject | AggregationObject[] =>
  (Array.isArray(expr) && isAggregationObject(expr[0])) ||
  isAggregationObject(expr)

const serializeFieldKey = (key: string) => key.replace('.', '\\\\_')

export const makeIdInternal = (key: string) => (key === 'id' ? '_id' : key)
const makeIdInternalIf = (key: string, useIdAsInternalId: boolean) =>
  useIdAsInternalId ? makeIdInternal(key) : key

export const makeIdInternalInPath = <T extends { path?: string | string[] }>(
  query: T,
): T =>
  typeof query.path === 'string'
    ? {
        ...query,
        path: makeIdInternal(query.path),
      }
    : Array.isArray(query.path)
    ? { ...query, path: query.path.map(makeIdInternal) }
    : query

const makeIdInternalOnObject = (obj: Record<string, unknown>) =>
  Object.fromEntries(
    Object.entries(obj).map(([key, value]) => [makeIdInternal(key), value]),
  )

const prepareGroupId = (fields: string[], useIdAsInternalId: boolean) =>
  fields.reduce(
    (obj, field) => ({
      ...obj,
      [makeIdInternalIf(
        serializeFieldKey(field),
        useIdAsInternalId,
      )]: `$${makeIdInternalIf(field, useIdAsInternalId)}`,
    }),
    {},
  )

const createFieldObject = (
  field: string,
  method: GroupMethod | GroupObject,
) => ({ [`$${method}`]: `$${field}` })

const prepareGroupFields = (
  fields: Record<string, GroupMethod | GroupObject>,
  useIdAsInternalId: boolean,
) =>
  Object.entries(fields).reduce(
    (obj, [field, method]) => ({
      ...obj,
      [serializeFieldKey(field)]:
        typeof method === 'string'
          ? createFieldObject(
              makeIdInternalIf(field, useIdAsInternalId),
              method,
            )
          : createFieldObject(
              makeIdInternalIf(method.path, useIdAsInternalId),
              method.op,
            ),
    }),
    {},
  )

const groupToMongo = (
  { groupBy, values }: AggregationObjectGroup,
  useIdAsInternalId: boolean,
) =>
  isObject(values)
    ? {
        $group: {
          _id: prepareGroupId(groupBy, useIdAsInternalId),
          ...prepareGroupFields(values, useIdAsInternalId),
        },
      }
    : undefined

const sortToMongo = (
  { sortBy }: AggregationObjectSort,
  useIdAsInternalId: boolean,
) =>
  isObject(sortBy) && Object.keys(sortBy).length > 0
    ? { $sort: useIdAsInternalId ? makeIdInternalOnObject(sortBy) : sortBy }
    : undefined

const queryToMongo = (
  { query }: AggregationObjectQuery,
  params: Record<string, unknown>,
  useIdAsInternalId: boolean,
) =>
  Array.isArray(query) && query.length > 0
    ? {
        $match: prepareFilter(query, params, undefined, useIdAsInternalId),
      }
    : undefined

const reduceToMongo = (
  { path, initialPath, pipeline }: AggregationObjectReduce,
  params: Record<string, unknown>,
  useIdAsInternalId: boolean,
) => ({
  $reduce: {
    input: `$${path}`,
    initialValue:
      typeof initialPath === 'string'
        ? `$${initialPath}`
        : dearrayIfPossible(
            prepareAggregation(
              ensureArray(initialPath),
              params,
              undefined,
              useIdAsInternalId,
            ),
          ),
    in: dearrayIfPossible(
      prepareAggregation(
        ensureArray(pipeline),
        params,
        undefined,
        useIdAsInternalId,
      ),
    ),
  },
})

const expressionToMongo = (
  expr: AggregationObject | AggregationObject[] | unknown,
  params: Record<string, unknown>,
) =>
  typeof expr === 'string'
    ? `$${expr}`
    : isAggregation(expr)
    ? dearrayIfPossible(prepareAggregation(ensureArray(expr), params))
    : expr

const ifToMongo = (
  { condition, then: thenArg, else: elseArg }: AggregationObjectIf,
  params: Record<string, unknown>,
  useIdAsInternalId: boolean,
) => ({
  $cond: {
    if: dearrayIfPossible(
      prepareFilter(
        ensureArray(condition),
        params,
        undefined,
        useIdAsInternalId,
      ),
    ),
    then: expressionToMongo(thenArg, params),
    else: expressionToMongo(elseArg, params),
  },
})

const prepareLookupValues = (variables: Record<string, string>) =>
  Object.entries(variables).reduce(
    (obj, [key, value]) => ({ ...obj, [key]: `$${value}` }),
    {},
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
  params: Record<string, unknown>,
  useIdAsInternalId: boolean,
) => ({
  $lookup: {
    from: collection,
    ...(typeof field === 'string'
      ? { foreignField: makeIdInternalIf(field, useIdAsInternalId) }
      : {}),
    ...(typeof path === 'string' ? { localField: path } : {}),
    ...(typeof (setPath ?? path) === 'string' ? { as: setPath ?? path } : {}),
    ...(variables && {
      let: prepareLookupValues(variables),
    }),
    ...(pipeline && {
      pipeline: dearrayIfPossible(
        prepareAggregation(
          ensureArray(pipeline),
          params,
          undefined,
          useIdAsInternalId,
        ),
      ),
    }),
  },
})

const projectToMongo = (
  { values }: AggregationObjectProject,
  params: Record<string, unknown>,
  useIdAsInternalId: boolean,
) => ({
  $project: Object.fromEntries(
    Object.entries(values).map(([key, value]) => [
      key,
      dearrayIfPossible(
        prepareAggregation(
          ensureArray(value),
          params,
          undefined,
          useIdAsInternalId,
        ),
      ),
    ]),
  ),
})

const limitToMongo = ({ count }: AggregationObjectLimit) => ({ $limit: count })

const unwindToMongo = ({ path }: AggregationObjectUnwind) => ({
  $unwind: {
    path: `$${path}`,
    preserveNullAndEmptyArrays: false,
  },
})

const rootToMongo = ({ path }: AggregationObjectRoot) => ({
  $replaceRoot: { newRoot: `$${path}` },
})

const concatArraysToMongo = ({ path }: AggregationObjectConcatArrays) => ({
  $concatArrays: path.map((p) => `$$${p}`),
})

const toMongo = (params: Record<string, unknown>, useIdAsInternalId = false) =>
  function toMongo(obj: AggregationObject) {
    switch (obj.type) {
      case 'group':
        return groupToMongo(obj, useIdAsInternalId)
      case 'sort':
        return sortToMongo(obj, useIdAsInternalId)
      case 'query':
        return queryToMongo(obj, params, useIdAsInternalId)
      case 'reduce':
        return reduceToMongo(
          makeIdInternalInPath(obj),
          params,
          useIdAsInternalId,
        )
      case 'if':
        return ifToMongo(obj, params, useIdAsInternalId)
      case 'lookup':
        return lookupToMongo(
          makeIdInternalInPath(obj),
          params,
          useIdAsInternalId,
        )
      case 'project':
        return projectToMongo(obj, params, useIdAsInternalId)
      case 'limit':
        return limitToMongo(obj)
      case 'unwind':
        return unwindToMongo(makeIdInternalInPath(obj))
      case 'root':
        return rootToMongo(makeIdInternalInPath(obj))
      case 'concatArrays':
        return concatArraysToMongo(makeIdInternalInPath(obj))
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
  isTopLevelPipeline = false,
  useIdAsInternalId = false,
): Aggregation[] | undefined {
  if (!Array.isArray(aggregation) || aggregation.length === 0) {
    return undefined
  }

  const pipeline = aggregation
    .map(toMongo(params, useIdAsInternalId))
    .filter(isNotEmpty)
  return pipeline.length > 0
    ? isTopLevelPipeline
      ? [
          ...ensureSorting(pipeline),
          { $setWindowFields: { output: { __totalCount: { $count: {} } } } }, // Adds total count to every document
        ]
      : pipeline
    : undefined
}
