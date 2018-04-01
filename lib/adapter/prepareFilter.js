const dotprop = require('dot-prop')

const setTypeOrId = (query, type, id) => {
  if (Object.keys(query).length === 0) {
    if (id) {
      query._id = `${type}:${id}`
    } else {
      query.type = type
    }
  }
}

const prepareFilter = ({type, id}, {query: queryProps = []}, params) => {
  // Create query object from array of props
  const query = queryProps.reduce((filter, prop) => {
    const value = (prop.param) ? params[prop.param] : prop.value
    return dotprop.set(filter, prop.path, value)
  }, {})

  // Set query props from id and type if no query was provided
  setTypeOrId(query, type, id)

  // Add query from payload params
  if (params && params.query) {
    Object.assign(query, params.query)
  }

  return query
}

module.exports = prepareFilter
