import dotprop = require('dot-prop')
import { TypedData } from 'integreat'
import { Payload } from './types'
import { btoa, removePadding } from './utils/base64'
import { isObject } from './utils/is'

export interface Paging {
  next?: Payload
  prev?: Payload
}

const isDataWithMongoId = (value: unknown): value is TypedData =>
  isObject(value) && typeof value._id === 'string' // Not quite right typing

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
      encodeValue(dotprop.get(lastItem, path)),
    ].join('')

const createPageId = (
  lastItem: TypedData,
  sort?: Record<string, number>
): string =>
  [
    lastItem._id,
    ...(sort
      ? Object.entries(sort).slice(0, 1).map(createSortString(lastItem))
      : ['>']),
  ].join('|')

const removeNonPageParams = ({
  data,
  target,
  typePlural,
  pageAfter,
  ...params
}: Record<string, unknown>) => params

export default function createPaging(
  data: unknown[],
  { type, id, pageSize, ...params }: Payload,
  sort?: Record<string, number>
): Paging {
  if (data.length === 0 || pageSize === undefined || data.length < pageSize) {
    return { next: undefined }
  }
  const lastItem = data[data.length - 1]
  const pageId = isDataWithMongoId(lastItem)
    ? removePadding(btoa(createPageId(lastItem, sort)))
    : undefined

  return {
    next: {
      ...(type && { type }),
      ...(id && { id }),
      ...removeNonPageParams(params),
      pageSize,
      pageId,
    },
  }
}
