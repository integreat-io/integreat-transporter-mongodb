async function connect (mongo, { sourceOptions }, connection = null) {
  if (connection) {
    return connection
  }

  const { baseUri } = sourceOptions
  if (!baseUri) {
    throw new TypeError('A baseUri is required when connecting to MongoDb')
  }

  try {
    const client = await mongo.connect(baseUri, { useNewUrlParser: true })
    return client
  } catch (error) {
    throw new Error(`Could not connect to MongoDb on ${baseUri}. Error: ${error.message}`)
  }
}

module.exports = connect
