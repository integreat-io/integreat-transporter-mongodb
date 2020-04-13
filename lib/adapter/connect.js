async function connect (mongo, sourceOptions, connection = null) {
  if (connection) {
    return connection
  }

  const { uri, baseUri } = sourceOptions
  const mongoUri = uri || baseUri
  if (!mongoUri) {
    throw new TypeError('A uri is required when connecting to MongoDb')
  }

  try {
    const client = await mongo.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    })
    return client
  } catch (error) {
    throw new Error(`Could not connect to MongoDb on ${mongoUri}. Error: ${error.message}`)
  }
}

module.exports = connect
