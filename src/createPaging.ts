import dotprop = require('dot-prop')
import { TypedData, Data } from 'integreat'
import { ExchangeRequest } from '.'

export interface Paging {
  next?: Record<string, Data> // TODO: Update when typing in Integreat changes
  prev?: Record<string, Data>
}

const createQuery = (lastItem: TypedData, sort?: Record<string, number>) => {
  if (sort) {
    return Object.entries(sort).reduce(
      (query, [key, direction]) => ({
        ...query,
        [key]: {
          [direction > 0 ? '$gte' : '$lte']: dotprop.get(lastItem, key),
        },
      }),
      {}
    )
  } else {
    return { _id: { $gte: lastItem._id } }
  }
}

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
  if (data.length === 0) {
    return { next: undefined }
  }
  const lastItem = data[data.length - 1]

  const query = createQuery(lastItem, sort)

  return {
    next: {
      ...(type && { type }),
      ...(id && { id }),
      ...params,
      pageSize,
      pageAfter: lastItem._id,
      query,
    },
  }
}
