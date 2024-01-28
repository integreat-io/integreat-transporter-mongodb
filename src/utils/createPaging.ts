import { encodePageId } from './pageId.js'
import type { Payload, AggregationObject } from '../types.js'

export interface Paging {
  next?: Payload
  prev?: Payload
}

const preparePageParams = (
  { data, target, typePlural, pageAfter, ...params }: Record<string, unknown>,
  type?: string | string[],
  id?: string | string[],
) => ({ ...(type && { type }), ...(id && { id }), ...params })

export default function createPaging(
  data: unknown[],
  { type, id, pageOffset, pageSize, ...params }: Payload,
  sort?: Record<string, number>,
  aggregation?: AggregationObject[],
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
    const pageId = encodePageId(lastItem, sort, aggregation)
    return {
      next: {
        ...preparePageParams(params, type, id),
        pageId,
        pageSize,
      },
    }
  }
}
