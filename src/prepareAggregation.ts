/* eslint-disable @typescript-eslint/ban-types */
import {
  AggregationObject,
  AggregationObjectGroup,
  AggregationObjectSort,
  AggregationObjectQuery,
  GroupMethod,
} from '.'
import { isObject } from './utils/is'
import prepareFilter from './prepareFilter'

const prepareGroupId = (fields: string[]) =>
  fields.reduce((obj, field) => ({ ...obj, [field]: `$${field}` }), {})

const prepareGroupFields = (fields: Record<string, GroupMethod>) =>
  Object.entries(fields).reduce(
    (obj, [field, method]) => ({
      ...obj,
      [field]: { [`$${method}`]: `$${field}` },
    }),
    {}
  )

const groupToMongo = ({ id, groupBy }: AggregationObjectGroup) =>
  isObject(groupBy)
    ? {
        $group: {
          _id: prepareGroupId(id),
          ...prepareGroupFields(groupBy),
        },
      }
    : undefined

const sortToMongo = ({ sortBy }: AggregationObjectSort) =>
  isObject(sortBy) && Object.keys(sortBy).length > 0
    ? { $sort: sortBy }
    : undefined

const queryToMongo = (
  { query }: AggregationObjectQuery,
  params: Record<string, unknown>
) =>
  Array.isArray(query) && query.length > 0
    ? {
        $match: prepareFilter(query, params),
      }
    : undefined

const toMongo = (params: Record<string, unknown>) =>
  function toMongo(obj: AggregationObject) {
    switch (obj.type) {
      case 'group':
        return groupToMongo(obj)
      case 'sort':
        return sortToMongo(obj)
      case 'query':
        return queryToMongo(obj, params)
      default:
        return undefined
    }
  }

export default function prepareAggregation(
  aggregation?: AggregationObject[],
  params: Record<string, unknown> = {}
): object[] | undefined {
  if (!Array.isArray(aggregation) || aggregation.length === 0) {
    return undefined
  }

  const pipeline = aggregation.map(toMongo(params)).filter(Boolean) as object[]
  return pipeline.length > 0 ? pipeline : undefined
}
