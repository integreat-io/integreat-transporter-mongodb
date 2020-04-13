const prepareFilter = require('./prepareFilter')
const getDocs = require('./getDocs')

const createItemResponse = ({ id, type }, status = 'ok', error = null) => {
  const response = { type, id, status }
  if (error) {
    response.error = error
  }
  return response
}

const returnOkOrError = (data, actionName) => {
  const hasError = data.some(item => item.status !== 'ok')
  return (!hasError)
    ? { status: 'ok', data }
    : { status: 'error', error: `Error ${actionName} item(s) in mongodb`, data }
}

const performOnObjectOrArray = async (data, fn, action) => {
  const actionName = (action === 'SET') ? 'updating' : 'deleting'
  if (Array.isArray(data)) {
    const responses = await Promise.all(data.map(fn))
    return returnOkOrError(responses, actionName)
  } else {
    const response = await fn(data)
    return returnOkOrError([response], actionName)
  }
}

const setOrDeleteData = async (getCollection, { endpoint, data, params }, action) => {
  const collection = getCollection()

  const performOne = async (item) => {
    const filter = prepareFilter(item, endpoint, params)
    const _id = `${item.type}:${item.id}`
    try {
      if (action === 'SET') {
        await collection.updateOne(filter, { $set: { ...item, _id } }, { upsert: true })
      } else {
        await collection.deleteOne(filter)
      }
    } catch (error) {
      return createItemResponse(item, 'error', error.message)
    }
    return createItemResponse(item)
  }

  return performOnObjectOrArray(data, performOne, action)
}

async function send (request, connection) {
  const getCollection = () => {
    const { endpoint } = request
    const db = connection.client.db(endpoint.db)
    return db.collection(endpoint.collection)
  }

  if (connection.status !== 'ok' || !connection.client) {
    return { status: 'error', error: 'No connection' }
  }

  switch (request.action) {
    case 'GET':
      return getDocs(getCollection, request)
    case 'SET':
    case 'DELETE':
      return setOrDeleteData(getCollection, request, request.action)
  }

  return { status: 'noaction' }
}

module.exports = send
