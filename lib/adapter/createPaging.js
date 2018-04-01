const dotprop = require('dot-prop')

const createQuery = (lastItem, sort) => {
  if (sort) {
    return Object.keys(sort).reduce((query, key) => {
      const value = dotprop.get(lastItem, key)
      const operator = (sort[key] > 0) ? '$gte' : '$lte'
      return {...query, [key]: {[operator]: value}}
    }, {})
  } else {
    return {_id: {$gte: lastItem._id}}
  }
}

const createPaging = (data, params, sort) => {
  if (data.length === 0) {
    return {next: null}
  }
  const lastItem = data[data.length - 1]

  const {typePlural, ...nextParams} = params

  const query = createQuery(lastItem, sort)

  return {
    next: {
      ...nextParams,
      pageSize: params.pageSize,
      pageAfter: lastItem._id,
      query
    }
  }
}

module.exports = createPaging
