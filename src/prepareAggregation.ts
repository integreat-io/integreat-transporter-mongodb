/* eslint-disable @typescript-eslint/ban-types */
import {
  AggregationObject,
  AggregationObjectGroup,
  AggregationObjectSort,
  AggregationObjectQuery,
  GroupMethod,
} from '.'
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

const groupToMongo = ({ id, groupBy }: AggregationObjectGroup) => ({
  $group: {
    _id: prepareGroupId(id),
    ...prepareGroupFields(groupBy),
  },
})

const sortToMongo = ({ sortBy }: AggregationObjectSort) =>
  Object.keys(sortBy).length > 0 ? { $sort: sortBy } : undefined

const queryToMongo = (
  { query }: AggregationObjectQuery,
  params: Record<string, unknown>
) =>
  query.length > 0
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
  return Array.isArray(aggregation) && aggregation.length > 0
    ? (aggregation.map(toMongo(params)).filter(Boolean) as object[])
    : undefined
}
