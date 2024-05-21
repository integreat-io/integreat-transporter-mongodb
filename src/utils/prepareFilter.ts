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

const opsWithoutValue = ['isset', 'notset']
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
  ...opsWithObject,
  ...opsWithoutValue,
]
const validValueTypes = ['string', 'number', 'boolean']

const isOpValid = (op: string) => validOps.includes(op)
const isValidValue = (value: unknown, op: string): boolean =>
  Array.isArray(value)
    ? value.every((value) => isValidValue(value, op))
    : validValueTypes.includes(typeof value) ||
      value instanceof Date ||
      (opsWithObject.includes(op) && isObject(value)) ||
      (value === null && opsWithoutValue.includes(op))

function mapOp(op: string, expr = false) {
  switch (op) {
    case 'eq':
      return expr ? '$eq' : undefined
    case 'isset':
      return '$ne'
    case 'notset':
      return '$eq'
    case 'search':
      return '$text.$search'
    case 'match':
      return '$elemMatch'
    default:
      return `$${op}`
  }
}

function setMongoSelectorFromQueryObj(
  allParams: Record<string, unknown>,
  { path, op = 'eq', value, valuePath, param, variable, expr }: QueryObject,
  useIdAsInternalId: boolean,
  filter = {},
) {
  if (isOpValid(op)) {
    let targetValue = variable
      ? `$$${variable}`
      : valuePath
        ? `$${valuePath}`
        : op === 'isArray'
          ? `$${path}`
          : (param ? allParams[param] : value) || null // eslint-disable-line security/detect-object-injection

    if (isObject(expr)) {
      targetValue = [
        `$${path}`,
        createFieldObject(
          makeIdInternalIf(Object.keys(expr)[0], useIdAsInternalId), // We only use the first key and value here for now ...
          Object.values(expr)[0],
        ),
      ]
    } else if (expr && op !== 'isArray') {
      targetValue = [`$${path}`, targetValue]
    }

    if (isValidValue(targetValue, op) || isObject(expr)) {
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
): Record<string, unknown> | null {
  // Create query object from array of props
  const queries = makeIdInternalInPathIf(
    mergeQueries(queryArray, params.query, pageId?.filter),
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
