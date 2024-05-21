/* eslint-disable security/detect-object-injection */
import { getProperty } from 'dot-prop'
import { atob, btoa, removePadding } from './base64.js'
import { isObject, isTypedData, isMongoData } from './is.js'
import type { TypedData } from 'integreat'
import type {
  QueryObject,
  AggregationObject,
  MongoData,
  ParsedPageId,
} from '../types.js'

// Encode

const arrowFromDirection = (direction: number) => (direction >= 0 ? '>' : '<')

const encodeValue = (value: unknown) =>
  typeof value === 'string'
    ? `"${encodeURIComponent(value)}"`
    : value instanceof Date
      ? value.toISOString()
      : value

const createSortString =
  (lastItem: Record<string, unknown>) =>
  ([path, direction]: [string, number]) =>
    [
      path,
      arrowFromDirection(direction),
      encodeValue(getProperty(lastItem, path)),
    ].join('')

function generateSortParts(
  lastItem: Record<string, unknown>,
  sort?: Record<string, number>,
): string {
  if (sort) {
    const firstEntry = Object.entries(sort)[0]
    if (firstEntry) {
      if (firstEntry[0] === '_id') {
        return arrowFromDirection(firstEntry[1])
      }
      return createSortString(lastItem)(firstEntry)
    }
  }
  return '>'
}

const generatePageIdFromId = (
  lastItem: TypedData,
  sort?: Record<string, number>,
): string =>
  [encodeValue(lastItem.id), generateSortParts(lastItem, sort)].join('|')

function generatePageIdFromMongoId(lastItem: MongoData): string {
  return [
    '', // To get the leading pipe that tells us this is an aggregation
    ...(isObject(lastItem._id)
      ? Object.entries(lastItem._id).map(
          ([key, value]) => `${key}|${encodeValue(value)}`,
        )
      : [lastItem._id]),
  ].join('|')
}

function generatePageId(
  lastItem: unknown,
  sort?: Record<string, number>,
  aggregation?: AggregationObject[],
) {
  if (aggregation) {
    if (isMongoData(lastItem) && isObject(lastItem._id)) {
      return generatePageIdFromMongoId(lastItem)
    } else if (isTypedData(lastItem)) {
      return generatePageIdFromId(lastItem)
    }
  } else if (isTypedData(lastItem)) {
    return generatePageIdFromId(lastItem, sort)
  }
  return undefined
}

// Decode

function decodePartValue(value?: string) {
  if (typeof value !== 'string') {
    return undefined
  }
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

const partRegex = /[\<\>]/

function createQueryObjectFromPageIdPart(part: string) {
  const match = part.split(partRegex)
  return match.length === 2
    ? {
        path: match[0],
        op: part.includes('>') ? 'gte' : 'lte',
        value: decodePartValue(match[1]),
      }
    : undefined
}

const generateQueryObject = (path: string, op: string, value: unknown) => ({
  path,
  op,
  value,
})

function filterFromSortParts(
  sortParts: string[],
  id: string | Record<string, unknown>,
): QueryObject[] {
  if (sortParts.length === 1 && sortParts[0] === '>') {
    return isObject(id)
      ? Object.entries(id).map(([path, value]) =>
          generateQueryObject(`_id.${path}`, 'gte', value),
        )
      : [generateQueryObject('id', 'gte', id)]
  } else {
    return sortParts
      .map(createQueryObjectFromPageIdPart)
      .filter(Boolean) as QueryObject[]
  }
}

function extractIdAndParts(
  pageId: string,
): [string | Record<string, unknown>, string[], boolean] {
  if (pageId.startsWith('|')) {
    // When the pageId starts with a pipe, we know it's a compound id (aggregation)
    const idParts = pageId.slice(1).split('|')
    const id: Record<string, unknown> = {}
    for (let i = 0; i < idParts.length; i += 2) {
      id[idParts[i]] = decodePartValue(idParts[i + 1])
    }
    return [id, [], true] // Aggregations have no sort parts
  } else {
    // There is no double pipe, so this is a simple pageId with a simple id
    const parts = pageId.split('|')
    return [decodePartValue(parts[0]), parts.slice(1), false]
  }
}

/**
 * Generate a pageId from data and base64 encode it.
 */
export function encodePageId(
  lastItem: unknown,
  sort?: Record<string, number>,
  aggregation?: AggregationObject[],
): string | undefined {
  const pageId = generatePageId(lastItem, sort, aggregation)
  return pageId ? removePadding(btoa(pageId)) : undefined
}

/**
 * Decode and parse a pageId from a base64 encoded string.
 */
export function decodePageId(encodedPageId?: string): ParsedPageId | undefined {
  const pageId = atob(encodedPageId)
  if (typeof pageId !== 'string') {
    return undefined
  }

  const [id, sortParts, isAgg] = extractIdAndParts(pageId)
  const filter = filterFromSortParts(sortParts, id)

  return { id, filter, isAgg }
}
