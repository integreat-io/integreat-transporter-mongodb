/* eslint-disable security/detect-object-injection */
import { getProperty } from 'dot-prop'
import { btoa, removePadding } from './base64.js'
import { isObject } from './is.js'
import type { TypedData } from 'integreat'
import type {
  Payload,
  AggregationObject,
  AggregationObjectSort,
} from '../types.js'

export interface Paging {
  next?: Payload
  prev?: Payload
}

interface MongoData extends Record<string, unknown> {
  _id: string | Record<string, unknown>
}

const isMongoData = (
  value: unknown,
  useIdAsInternalId = false,
): value is MongoData =>
  isObject(value) && (useIdAsInternalId ? !!value.id : !!value._id)

const isTypedData = (value: unknown): value is TypedData =>
  isObject(value) && typeof value.id === 'string'

const isSortAggregation = (
  aggregation: AggregationObject,
): aggregation is AggregationObjectSort => aggregation.type === 'sort'
const isRegroupingAggregation = (aggregation: AggregationObject) =>
  aggregation.type === 'group'

const encodeValue = (value: unknown) =>
  typeof value === 'string'
    ? `"${encodeURIComponent(value)}"`
    : value instanceof Date
      ? value.toISOString()
      : value

const preparePageParams = (
  { data, target, typePlural, pageAfter, ...params }: Record<string, unknown>,
  type?: string | string[],
  id?: string | string[],
) => ({ ...(type && { type }), ...(id && { id }), ...params })

const arrowFromDirection = (direction: number) => (direction >= 0 ? '>' : '<')

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
): string => [lastItem.id, generateSortParts(lastItem, sort)].join('|')

function generatePageIdFromMongoId(
  useIdAsInternalId: boolean,
  lastItem: MongoData,
  sort?: Record<string, number>,
): string {
  const id = useIdAsInternalId ? lastItem.id : lastItem._id
  return [
    ...(isObject(id)
      ? Object.entries(lastItem._id).map((entry) => entry.join('|'))
      : [id]),
    '', // To get a double pipe
    generateSortParts(lastItem, sort),
  ].join('|')
}

function generatePageId(
  lastItem: unknown,
  sort?: Record<string, number>,
  aggregation?: AggregationObject[],
  useIdAsInternalId = false,
) {
  if (aggregation) {
    if (isMongoData(lastItem, useIdAsInternalId)) {
      const sortIndex = aggregation.findLastIndex(isSortAggregation)
      const groupIndex = aggregation.findLastIndex(isRegroupingAggregation)
      const aggSort =
        sortIndex > groupIndex
          ? (aggregation[sortIndex] as AggregationObjectSort | undefined)
              ?.sortBy
          : undefined
      return generatePageIdFromMongoId(useIdAsInternalId, lastItem, aggSort)
    }
  } else if (isTypedData(lastItem)) {
    return generatePageIdFromId(lastItem, sort)
  }
  return undefined
}

const encodeId = (id?: string) => (id ? removePadding(btoa(id)) : undefined)

export default function createPaging(
  data: unknown[],
  { type, id, pageOffset, pageSize, ...params }: Payload,
  sort?: Record<string, number>,
  aggregation?: AggregationObject[],
  useIdAsInternalId = false,
): Paging {
  if (data.length === 0 || pageSize === undefined || data.length < pageSize) {
    return { next: undefined }
  }

  if (typeof pageOffset === 'number') {
    return {
      next: {
        ...preparePageParams(params, type, id),
        pageOffset: pageOffset + pageSize,
        pageSize,
      },
    }
  } else {
    const lastItem = data[data.length - 1]
    const pageId = encodeId(
      generatePageId(lastItem, sort, aggregation, useIdAsInternalId),
    )
    return {
      next: {
        ...preparePageParams(params, type, id),
        pageId,
        pageSize,
      },
    }
  }
}
