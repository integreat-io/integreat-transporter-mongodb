import { getProperty } from 'dot-prop'
import { TypedData } from 'integreat'
import { Payload } from './types.js'
import { btoa, removePadding } from './utils/base64.js'
import { isObject } from './utils/is.js'

export interface Paging {
  next?: Payload
  prev?: Payload
}

const isDataWithMongoId = (value: unknown): value is TypedData =>
  isObject(value) && typeof value.id === 'string'

const encodeValue = (value: unknown) =>
  typeof value === 'string'
    ? `"${encodeURIComponent(value)}"`
    : value instanceof Date
    ? value.toISOString()
    : value

const createSortString =
  (lastItem: TypedData) =>
  ([path, direction]: [string, number]) =>
    [
      path,
      direction > 0 ? '>' : '<',
      encodeValue(getProperty(lastItem, path)),
    ].join('')

const createPageId = (
  lastItem: TypedData,
  sort?: Record<string, number>
): string =>
  [
    lastItem.id,
    ...(sort
      ? Object.entries(sort).slice(0, 1).map(createSortString(lastItem))
      : ['>']),
  ].join('|')

const preparePageParams = (
  { data, target, typePlural, pageAfter, ...params }: Record<string, unknown>,
  type?: string | string[],
  id?: string | string[]
) => ({ ...(type && { type }), ...(id && { id }), ...params })

export default function createPaging(
  data: unknown[],
  { type, id, pageOffset, pageSize, ...params }: Payload,
  sort?: Record<string, number>
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
    const pageId = isDataWithMongoId(lastItem)
      ? removePadding(btoa(createPageId(lastItem, sort)))
      : undefined

    return {
      next: {
        ...preparePageParams(params, type, id),
        pageId,
        pageSize,
      },
    }
  }
}
