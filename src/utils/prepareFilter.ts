import { setProperty } from 'dot-prop'
import { serializePath } from './serialize.js'
import { isObject } from './is.js'
import { ensureArray } from './array.js'
import {
  makeIdInternalInPath,
  makeIdInternalIf,
  createFieldObject,
} from './prepareAggregation.js'
import type { QueryObject, ParsedPageId } from '../types.js'

type QueryArray = (QueryObject | QueryArray)[]

export interface Params extends Record<string, unknown> {
  id?: string | string[] | number
  type?: string | string[]
  query?: QueryArray
  pageId?: string
}

const makeIdInternalInPathIf = (
  query: QueryObject[],
  useIdAsInternalId: boolean,
) => (useIdAsInternalId ? query.map(makeIdInternalInPath) : query)

const dateStringRegex =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d\d\d)?([+-]\d{2}:\d{2}|Z)$/
const isDateString = (value: unknown): value is string =>
  typeof value === 'string' && dateStringRegex.test(value)
const castValueIfDate = (value: unknown): unknown =>
  isDateString(value)
    ? new Date(value)
    : isObject(value)
      ? castDates(value)
      : value

const castDates = (query: Record<string, unknown>) =>
  Object.entries(query).reduce(
    (casted, [key, value]) => ({ ...casted, [key]: castValueIfDate(value) }),
    {},
  )

const mergeQueries = (...queries: (QueryArray | QueryObject | undefined)[]) =>
  queries.flat().filter(Boolean) as QueryObject[]

const opsWithObject = ['match']
const validOps = [
  'eq',
  'ne',
  'lt',
  'gt',
  'lte',
  'gte',
  'in',
  'nin',
  'regex',
  'isArray',
  'search',
  'isset',
  'notset',
  'arrayElemAt',
  ...opsWithObject,
]
const validValueTypes = ['string', 'number', 'boolean']

const isOpValid = (op: string) => validOps.includes(op)
const isValidValue = (value: unknown, op: string): boolean =>
  Array.isArray(value)
    ? value.every((value) => isValidValue(value, op))
    : validValueTypes.includes(typeof value) ||
      value === null ||
      value instanceof Date ||
      (opsWithObject.includes(op) && isObject(value))

function mapOp(op: string, expr = false) {
  switch (op) {
    case 'eq':
      return expr ? '$eq' : undefined
    case 'isset':
    case 'notset':
      return '$exists'
    case 'search':
      return '$text.$search'
    case 'match':
      return '$elemMatch'
    default:
      return `$${op}`
  }
}

function getQueryValueForOperator(
  op: string,
  params: Record<string, unknown>,
  value: unknown,
  path?: string,
  param?: string,
) {
  switch (op) {
    case 'isArray':
      return `$${path}`
    case 'isset':
      return true // Will be used with $exists
    case 'notset':
      return false // Will be used with $exists
    default:
      return (param ? params[param] : value) ?? null // eslint-disable-line security/detect-object-injection
  }
}

const createPathWithDefault = (path: string, def?: unknown) =>
  def !== undefined ? { $ifNull: [`$${path}`, def] } : `$${path}`

export function setMongoSelectorFromQueryObj(
  allParams: Record<string, unknown>,
  {
    path: rawPath,
    op = 'eq',
    value,
    valuePath,
    param,
    variable,
    expr,
    default: def,
  }: QueryObject,
  useIdAsInternalId: boolean,
  filter = {},
) {
  const path = rawPath && makeIdInternalIf(rawPath, useIdAsInternalId)
  // TODO: Handle when `path` is `undefined`
  if (isOpValid(op)) {
    let targetValue = variable
      ? `$$${variable}`
      : valuePath
        ? `$${valuePath}`
        : getQueryValueForOperator(op, allParams, value, path, param)

    if (isObject(expr)) {
      targetValue = [
        createPathWithDefault(path!, def),
        createFieldObject(
          makeIdInternalIf(Object.keys(expr)[0], useIdAsInternalId), // We only use the first key and value here for now ...
          Object.values(expr)[0],
        ),
      ]
    } else if (expr && op !== 'isArray') {
      targetValue = [createPathWithDefault(path!, def), targetValue]
    }

    if (isValidValue(targetValue, op) || isObject(expr) || def !== undefined) {
      const targetPath = [
        expr
          ? '$expr'
          : op === 'isArray' || op === 'search' || typeof path !== 'string'
            ? undefined
            : serializePath(path),
        mapOp(op, !!expr),
      ]
        .filter(Boolean)
        .join('.')

      return setProperty(filter, targetPath, targetValue)
    }
  }

  return filter
}

export const setMongoSelectorFromQuery =
  (allParams: Record<string, unknown>, useIdAsInternalId: boolean) =>
  (filter: Record<string, unknown>, query: QueryObject | QueryObject[]) =>
    Array.isArray(query)
      ? {
          ...filter,
          $or: query.map((queryObj) =>
            mongoSelectorFromQuery(allParams, queryObj, useIdAsInternalId),
          ),
        }
      : setMongoSelectorFromQueryObj(
          allParams,
          query,
          useIdAsInternalId,
          filter,
        )

const mongoSelectorFromQuery = (
  allParams: Record<string, unknown>,
  query: QueryObject | QueryObject[],
  useIdAsInternalId: boolean,
): Record<string, unknown> =>
  ensureArray(query).reduce(
    setMongoSelectorFromQuery(allParams, useIdAsInternalId),
    {},
  )

/**
 * Generate the right query object as a filter for finding docs in the database.
 */
export default function prepareFilter(
  queryArray: QueryArray = [],
  params: Params = {},
  pageId?: ParsedPageId,
  useIdAsInternalId = false,
  appendOnly = false,
  shouldIncludeParamsQuery = true,
): Record<string, unknown> | null {
  // Create query object from array of props
  const queries = makeIdInternalInPathIf(
    mergeQueries(
      queryArray,
      shouldIncludeParamsQuery ? params.query : undefined,
      pageId?.filter,
    ),
    useIdAsInternalId,
  )
  const query = mongoSelectorFromQuery(params, queries, useIdAsInternalId)

  // Query for id if no query was provided and this is a member action
  if (queryArray.length === 0)
    if (appendOnly) {
      return null
    } else if (params.id) {
      const id = String(params.id)
      if (useIdAsInternalId) {
        query._id = id
      } else {
        query.id = id
      }
    }

  return castDates(query)
}
