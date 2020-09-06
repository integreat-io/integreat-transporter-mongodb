import dotprop = require('dot-prop')
import is from '@sindresorhus/is'
import { MongoOptions } from '.'

const setTypeOrId = (
  query: Record<string, unknown>,
  type?: string | string[],
  id?: string | string[]
) => {
  if (Object.keys(query).length === 0) {
    if (id) {
      query._id = `${type}:${id}`
    } else {
      query.type = type
    }
  }
}

const castDates = (query: Record<string, unknown>) =>
  Object.entries(query).reduce(
    (casted, [key, value]) => ({ ...casted, [key]: castValueIfDate(value) }),
    {}
  )

const dateStringRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?([+-]\d{2}:\d{2}|Z)$/
const isDateString = (value: unknown): value is string =>
  typeof value === 'string' && dateStringRegex.test(value)
const castValueIfDate = (value: unknown): unknown =>
  isDateString(value)
    ? new Date(value)
    : is.plainObject(value)
    ? castDates(value)
    : value

/**
 * Generate the right query object as a filter for finding docs in the database.
 */
export default function prepareFilter(
  { query: queryProps = [] }: MongoOptions = {},
  type?: string | string[],
  id?: string | string[],
  params: Record<string, unknown> = {}
): Record<string, unknown> {
  const allParams: Record<string, unknown> = { type, id, ...params }
  // Create query object from array of props
  const query = queryProps.reduce(
    (filter, { param, path, value }) =>
      // eslint-disable-next-line security/detect-object-injection
      dotprop.set(filter, path, param ? allParams[param] : value),
    {}
  )

  // Set query props from id and type if no query was provided
  setTypeOrId(query, type, id)

  // Add query from payload params
  if (params?.query) {
    Object.assign(query, params.query)
  }

  return castDates(query)
}
