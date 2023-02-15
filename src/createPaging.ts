/* eslint-disable security/detect-object-injection */
import { getProperty } from 'dot-prop'
import { TypedData } from 'integreat'
import { Payload, AggregationObject, AggregationObjectSort } from './types.js'
import { btoa, removePadding } from './utils/base64.js'
import { isObject } from './utils/is.js'

export interface Paging {
  next?: Payload
  prev?: Payload
}

interface MongoData extends Record<string, unknown> {
  _id: string | Record<string, unknown>
}

const isMongoData = (value: unknown): value is MongoData =>
  isObject(value) && !!value._id

const isTypedData = (value: unknown): value is TypedData =>
  isObject(value) && typeof value.id === 'string'

const isSortAggregation = (
  aggregation: AggregationObject
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
  id?: string | string[]
) => ({ ...(type && { type }), ...(id && { id }), ...params })

const createSortString =
  (lastItem: Record<string, unknown>) =>
  ([path, direction]: [string, number]) =>
    [
      path,
      direction > 0 ? '>' : '<',
      encodeValue(getProperty(lastItem, path)),
    ].join('')

const generateSortParts = (
  lastItem: Record<string, unknown>,
  sort?: Record<string, number>
): string[] =>
  sort
    ? Object.entries(sort).slice(0, 1).map(createSortString(lastItem))
    : ['>']

const generatePageIdFromId = (
  lastItem: TypedData,
  sort?: Record<string, number>
): string => [lastItem.id, ...generateSortParts(lastItem, sort)].join('|')

const generatePageIdFromMongoId = (
  lastItem: MongoData,
  sort?: Record<string, number>
): string =>
  [
    ...(isObject(lastItem._id)
      ? Object.entries(lastItem._id).map((entry) => entry.join('|'))
      : lastItem._id),
    '', // To get a double pipe
    ...generateSortParts(lastItem, sort),
  ].join('|')

function generatePageId(
  lastItem: unknown,
  sort?: Record<string, number>,
  aggregation?: AggregationObject[]
) {
  if (aggregation) {
    if (isMongoData(lastItem)) {
      const sortIndex = aggregation.findLastIndex(isSortAggregation)
      const groupIndex = aggregation.findLastIndex(isRegroupingAggregation)
      const aggSort =
        sortIndex > groupIndex
          ? (aggregation[sortIndex] as AggregationObjectSort | undefined)
              ?.sortBy
          : undefined
      return generatePageIdFromMongoId(lastItem, aggSort)
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
  aggregation?: AggregationObject[]
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
    const pageId = encodeId(generatePageId(lastItem, sort, aggregation))
    return {
      next: {
        ...preparePageParams(params, type, id),
        pageId,
        pageSize,
      },
    }
  }
}
