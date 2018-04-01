const prepareFilter = require('./prepareFilter')
const createPaging = require('./createPaging')

// Move the cursor to the first doc after the `pageAfter`
// When no `pageAfter`, just start from the beginning
const moveToData = async (cursor, pageAfter) => {
  if (!pageAfter) {
    // Start from the beginning
    return true
  }

  let doc
  do {
    doc = await cursor.next()
  } while (doc && doc._id !== pageAfter)

  return !!doc // false if the doc to start after is not found
}

// Get one page of docs from where the cursor is
const getData = async (cursor, pageSize) => {
  const data = []

  while (data.length < pageSize) {
    const doc = await cursor.next()
    if (!doc) {
      break
    }
    data.push(doc)
  }

  return data
}

const getPage = async (cursor, {pageSize = Infinity, pageAfter}) => {
  // When pageAfter is set – loop until we find the doc with that _id
  const foundFirst = moveToData(cursor, pageAfter)

  // Get the number of docs specified with pageSize - or the rest of the docs
  if (foundFirst) {
    return getData(cursor, pageSize)
  }

  return []
}

async function getDocs (getCollection, {endpoint, params}) {
  const collection = getCollection()

  const filter = prepareFilter(params, endpoint, params)
  let cursor = await collection.find(filter)
  if (endpoint.sort) {
    cursor = cursor.sort(endpoint.sort)
  }
  const data = await getPage(cursor, params)

  if (data.length === 0 && params.id) {
    return {
      status: 'notfound',
      error: `Could not find '${params.id}' of type '${params.type}'`
    }
  }

  const response = {status: 'ok', data}

  if (params.pageSize) {
    response.paging = createPaging(data, params, endpoint.sort)
  }

  return response
}

module.exports = getDocs
