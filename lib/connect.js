async function connect (mongo, {sourceOptions}, connection = null) {
  if (connection) {
    return connection
  }

  const {dbUri} = sourceOptions
  if (!dbUri) {
    throw new TypeError('A dbUri is required when connecting to MongoDb')
  }

  try {
    const client = await mongo.connect(dbUri)
    return client
  } catch (error) {
    throw new Error(`Could not connect to MongoDb on ${dbUri}. Error: ${error.message}`)
  }
}

module.exports = connect
