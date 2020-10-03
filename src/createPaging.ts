/* eslint-disable security/detect-object-injection */
import dotprop = require('dot-prop')
import { TypedData, Data } from 'integreat'
import { ExchangeRequest } from '.'

export interface Paging {
  next?: Record<string, Data> // TODO: Update when typing in Integreat changes
  prev?: Record<string, Data>
}

type QueryObject = Record<string, string | number | undefined>
type Query = Record<string, QueryObject>

const createQueryObject = (key: string, value?: string | number) => ({
  [key]: value,
})

const createQuery = (
  lastItem: TypedData,
  sort?: Record<string, number>,
  oldQuery: Query = {}
) => {
  if (sort) {
    return Object.entries(sort).reduce(
      (query, [key, direction]) => ({
        ...query,
        [key]: {
          ...oldQuery[key],
          ...createQueryObject(
            direction > 0 ? '$gte' : '$lte',
            dotprop.get(lastItem, key)
          ),
        },
      }),
      { ...oldQuery }
    )
  } else {
    return { ...oldQuery, _id: { $gte: lastItem._id } }
  }
}

export default function createPaging(
  data: TypedData[],
  {
    type,
    id,
    pageSize,
    params: { typePlural, query: oldQuery, ...params } = {},
  }: ExchangeRequest,
  sort?: Record<string, number>
): Paging {
  if (data.length === 0) {
    return { next: undefined }
  }
  const lastItem = data[data.length - 1]

  const query = createQuery(lastItem, sort, oldQuery as Query | undefined)

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
