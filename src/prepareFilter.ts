import dotprop = require('dot-prop')
import { QueryObject } from '.'
import { serializePath } from './escapeKeys'
import { atob } from './utils/base64'

export interface Params extends Record<string, unknown> {
  query?: QueryObject[]
  pageId?: string
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  Object.prototype.toString.call(value) === '[object Object]'

const setTypeOrId = (
  query: Record<string, unknown>,
  hasQueryProps: boolean,
  type?: string | string[],
  id?: string | string[] | number
) => {
  if (!hasQueryProps) {
    if (id) {
      query._id = [type, String(id)].filter(Boolean).join(':')
    } else if (type) {
      query['\\$type'] = type
    }
  }
}

const dateStringRegex = /^\d\d\d\d-\d\d-\d\dT\d\d:\d\d:\d\d(\.\d\d\d)?([+-]\d\d:\d\d|Z)$/
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

const mergeQueries = (
  ...queries: ((QueryObject | undefined)[] | undefined)[]
) => queries.flat().filter(Boolean) as QueryObject[]

const validOps = ['eq', 'lt', 'gt', 'lte', 'gte', 'in']
const validValueTypes = ['string', 'number', 'boolean']

const isOpValid = (op: string) => validOps.includes(op)
const isValidValue = (value: unknown): boolean =>
  Array.isArray(value)
    ? value.every(isValidValue)
    : validValueTypes.includes(typeof value) || value instanceof Date
const mapOp = (op: string) => (op === 'eq' ? undefined : `$${op}`)

const setMongoSelectorFromQueryProp = (allParams: Record<string, unknown>) =>
  function (
    filter: Record<string, unknown>,
    { path, op = 'eq', value, param }: QueryObject
  ) {
    if (isOpValid(op)) {
      // eslint-disable-next-line security/detect-object-injection
      const comparee = param ? allParams[param] : value
      if (isValidValue(comparee)) {
        return dotprop.set(
          filter,
          [path === 'type' ? '\\$type' : serializePath(path), mapOp(op)]
            .filter(Boolean)
            .join('.'),
          comparee
        )
      }
    }

    return filter
  }

const partRegex = /^(.+)([\<\>])(.+)$/

function decodePartValue(value: string) {
  if (value.startsWith('"')) {
    return decodeURIComponent(value.slice(1, value.lastIndexOf('"')))
  } else {
    try {
      return JSON.parse(value)
    } catch {
      return value
    }
  }
}

function createQueryObjectFromPageIdPart(part: string) {
  const match = partRegex.exec(part)
  return match
    ? {
        path: match[1],
        op: match[2] === '>' ? 'gte' : 'lte',
        value: decodePartValue(match[3]),
      }
    : undefined
}

function expandPageIdAsQuery(pageId?: string) {
  const parts = pageId?.split('|')
  if (Array.isArray(parts) && parts.length > 0) {
    if (parts.length === 2 && parts[1] === '>') {
      return [{ path: '_id', op: 'gte', value: parts[0] }]
    } else {
      return parts.slice(1).map(createQueryObjectFromPageIdPart)
    }
  }
  return undefined
}

/**
 * Generate the right query object as a filter for finding docs in the database.
 */
export default function prepareFilter(
  queryProps: QueryObject[] = [],
  type?: string | string[],
  id?: string | string[] | number,
  params: Params = {}
): Record<string, unknown> {
  // Create query object from array of props
  const pageQuery = expandPageIdAsQuery(atob(params.pageId))
  const query = mergeQueries(queryProps, params.query, pageQuery).reduce(
    setMongoSelectorFromQueryProp({ type, id, ...params }),
    {}
  )

  // Set query props from id and type if no query was provided
  setTypeOrId(query, queryProps.length > 0, type, id)

  return castDates(query)
}
