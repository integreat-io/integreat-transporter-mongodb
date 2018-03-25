const prepareFilter = ({type, id}) => {
  return (id) ? {type, id} : {type}
}

const createItemResponse = ({id, type}, status = 'ok', error = null) => {
  const response = {type, id, status}
  if (error) {
    response.error = error
  }
  return response
}

const returnOkOrError = (data, actionName) => {
  const hasError = data.some(item => item.status !== 'ok')
  return (!hasError)
    ? {status: 'ok', data}
    : {status: 'error', error: `Error ${actionName} item(s) in mongodb`, data}
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

const getData = async (getCollection, {endpoint, params}) => {
  const collection = getCollection()

  const filter = prepareFilter(params)
  const data = await collection.find(filter).toArray()

  return {status: 'ok', data}
}

const setOrDeleteData = async (getCollection, {endpoint, data}, action) => {
  const collection = getCollection()

  const performOne = (item) => {
    const filter = prepareFilter(item)
    try {
      if (action === 'SET') {
        collection.updateOne(filter, {$set: item}, {upsert: true})
      } else {
        collection.deleteOne(filter)
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
    const {endpoint} = request
    const db = connection.db(endpoint.db)
    return db.collection(endpoint.collection)
  }

  switch (request.action) {
    case 'GET':
      return getData(getCollection, request)
    case 'SET':
    case 'DELETE':
      return setOrDeleteData(getCollection, request, request.action)
  }

  return {status: 'noaction'}
}

module.exports = send
