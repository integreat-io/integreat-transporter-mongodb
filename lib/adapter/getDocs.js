const prepareFilter = require('./prepareFilter')

const createPaging = (data, params) => {
  if (data.length === 0) {
    return {}
  }
  const lastId = data[data.length - 1]._id
  return {
    next: {
      pageSize: params.pageSize,
      pageAfter: lastId,
      query: {_id: {$gte: lastId}}
    }
  }
}

const getPage = async (cursor, {pageSize = Infinity, pageAfter}) => {
  const data = []

  // When pageAfter is set – loop until we find the doc with that _id
  if (pageAfter) {
    let doc
    do {
      doc = await cursor.next()
    } while (doc && doc._id !== pageAfter)
  }

  // Get the number of docs specified with pageSize - or the rest of the docs
  while (data.length < pageSize) {
    const doc = await cursor.next()
    if (!doc) {
      break
    }
    data.push(doc)
  }

  return data
}

async function getDocs (getCollection, {endpoint, params}) {
  const collection = getCollection()

  const filter = prepareFilter(params, endpoint, params)
  let cursor = await collection.find(filter)
  const data = await getPage(cursor, params)

  if (data.length === 0 && params.id) {
    return {
      status: 'notfound',
      error: `Could not find '${params.id}' of type '${params.type}'`
    }
  }

  const response = {status: 'ok', data}

  if (params.pageSize) {
    response.paging = createPaging(data, params)
  }

  return response
}

module.exports = getDocs
