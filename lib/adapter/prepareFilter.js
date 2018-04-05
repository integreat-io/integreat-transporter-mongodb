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

const dateStringRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?([+-]\d{2}:\d{2}|Z)$/
const isDateString = (value) => typeof value === 'string' && dateStringRegex.test(value)
const castValueIfDate = (value) => (isDateString(value)) ? new Date(value) : value

const castDates = (query) => Object.keys(query).reduce(
  (casted, key) => ({...casted, [key]: castValueIfDate(query[key])}),
  {}
)

/**
 * Generate the right query object as a filter for finding docs in the database.
 *
 * @param {Object} item - Any object with type and optionally id
 * @param {Object} endpiont - The endpoint object
 * @param {Object} params - The params object
 * @returns {Object} A query object for MongoDB's find() method
 */
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

  return castDates(query)
}

module.exports = prepareFilter
