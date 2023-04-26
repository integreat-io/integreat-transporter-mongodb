import { setProperty } from 'dot-prop'
import { QueryObject } from './types.js'
import { serializePath } from './escapeKeys.js'
import { DecodedPageId } from './utils/pageId.js'

type QueryArray = (QueryObject | QueryArray)[]

export interface Params extends Record<string, unknown> {
  id?: string | string[] | number
  type?: string | string[]
  query?: QueryArray
  pageId?: string
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  Object.prototype.toString.call(value) === '[object Object]'

const dateStringRegex =
  /^\d\d\d\d-\d\d-\d\dT\d\d:\d\d:\d\d(\.\d\d\d)?([+-]\d\d:\d\d|Z)$/
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
    {}
  )

const mergeQueries = (...queries: (QueryArray | QueryObject | undefined)[]) =>
  queries.flat().filter(Boolean) as QueryObject[]

const opsWithoutValue = ['isset', 'notset']
const validOps = [
  'eq',
  'lt',
  'gt',
  'lte',
  'gte',
  'in',
  'regex',
  'isArray',
  'search',
  ...opsWithoutValue,
]
const validValueTypes = ['string', 'number', 'boolean']

const isOpValid = (op: string) => validOps.includes(op)
const isValidValue = (value: unknown, op: string): boolean =>
  Array.isArray(value)
    ? value.every((value) => isValidValue(value, op))
    : validValueTypes.includes(typeof value) ||
      value instanceof Date ||
      (value === null && opsWithoutValue.includes(op))

function mapOp(op: string) {
  switch (op) {
    case 'eq':
      return undefined
    case 'isset':
      return '$ne'
    case 'notset':
      return '$eq'
    case 'search':
      return '$text.$search'
    default:
      return `$${op}`
  }
}

function setMongoSelectorFromQueryObj(
  allParams: Record<string, unknown>,
  { path, op = 'eq', value, param, variable, expr }: QueryObject,
  filter = {}
) {
  if (isOpValid(op)) {
    let targetValue = variable
      ? `$$${variable}`
      : op === 'isArray'
      ? `$${path}`
      : (param ? allParams[param] : value) || null // eslint-disable-line security/detect-object-injection

    if (expr && op === 'in') {
      targetValue = [`$${path}`, targetValue]
    }

    if (isValidValue(targetValue, op)) {
      const targetPath = [
        expr
          ? '$expr'
          : op === 'isArray' || op === 'search' || typeof path !== 'string'
          ? undefined
          : serializePath(path),
        mapOp(op),
      ]
        .filter(Boolean)
        .join('.')

      return setProperty(filter, targetPath, targetValue)
    }
  }

  return filter
}

const setMongoSelectorFromQuery =
  (allParams: Record<string, unknown>) =>
  (filter: Record<string, unknown>, query: QueryObject | QueryObject[]) =>
    Array.isArray(query)
      ? {
          ...filter,
          $or: query.map((queryObj) =>
            mongoSelectorFromQuery(allParams, queryObj)
          ),
        }
      : setMongoSelectorFromQueryObj(allParams, query, filter)

const mongoSelectorFromQuery = (
  allParams: Record<string, unknown>,
  query: QueryObject | QueryObject[]
): Record<string, unknown> =>
  ([] as QueryObject[])
    .concat(query)
    .reduce(setMongoSelectorFromQuery(allParams), {})

/**
 * Generate the right query object as a filter for finding docs in the database.
 */
export default function prepareFilter(
  queryArray: QueryArray = [],
  params: Params = {},
  pageId?: DecodedPageId
): Record<string, unknown> {
  // Create query object from array of props
  const query = mongoSelectorFromQuery(
    params,
    mergeQueries(queryArray, params.query, pageId?.filter)
  )

  // Query for id if no query was provided and this is a member action
  if (queryArray.length === 0 && params.id) {
    query.id = String(params.id)
  }

  return castDates(query)
}
