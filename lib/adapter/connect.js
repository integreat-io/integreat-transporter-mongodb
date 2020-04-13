module.exports = async function connect (mongo, sourceOptions, connection = null) {
  if (connection) {
    return connection
  }

  const { uri, baseUri } = sourceOptions
  const mongoUri = uri || baseUri
  if (!mongoUri) {
    return {
      status: 'badrequest',
      error: 'A uri is required when connecting to MongoDb'
    }
  }

  try {
    const client = await mongo.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    })
    return { status: 'ok', client }
  } catch (error) {
    return {
      status: 'error',
      error: `Could not connect to MongoDb on ${mongoUri}. Error: ${error.message}`
    }
  }
}
