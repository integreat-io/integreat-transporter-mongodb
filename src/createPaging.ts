import dotprop = require('dot-prop')
import { TypedData, Data } from 'integreat'
import { ExchangeRequest } from '.'
import { btoa, removePadding } from './utils/base64'

export interface Paging {
  next?: Record<string, Data> // TODO: Update when typing in Integreat changes
  prev?: Record<string, Data>
}

const encodeValue = (value: unknown) =>
  typeof value === 'string' ? `"${encodeURIComponent(value)}"` : value

const createSortString = (lastItem: TypedData) => ([path, direction]: [
  string,
  number
]) =>
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
    ...(sort ? Object.entries(sort).map(createSortString(lastItem)) : ['>']),
  ].join('|')

export default function createPaging(
  data: TypedData[],
  {
    type,
    id,
    pageSize,
    params: { typePlural, ...params } = {},
  }: ExchangeRequest,
  sort?: Record<string, number>
): Paging {
  if (data.length === 0 || pageSize === undefined || data.length < pageSize) {
    return { next: undefined }
  }
  const lastItem = data[data.length - 1]
  const pageId = removePadding(btoa(createPageId(lastItem, sort)))

  return {
    next: {
      ...(type && { type }),
      ...(id && { id }),
      ...params,
      pageSize,
      pageId,
    },
  }
}
