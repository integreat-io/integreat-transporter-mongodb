import mongodb = require('mongodb')
import connect from './connect'
import disconnect from './disconnect'
import send from './send'
import { Transporter } from 'integreat'
import { MongoOptions, Connection } from './types'
export * from './types'

/**
 * MongoDB Transporter for Integreat
 */
const mongodbTransporter: Transporter = {
  authentication: 'asObject',

  /**
   * Prepare endpoint options.
   */
  prepareOptions(options: MongoOptions) {
    return options
  },

  /**
   * Connect to the service in any way relevant for this transporter, and return
   * an object or a value that the transporter may later use when sending
   * requests to the service and when disconnecting.
   *
   * The MongoDb transporter will connect to the database and return the client
   * object.
   */
  async connect(options, auth, connection: Connection | null, emit) {
    return connect(mongodb.MongoClient, options, emit, auth, connection)
  },

  /**
   * Disconnect from the source if relevant. The method is given the return
   * value from the connect method.
   */
  async disconnect(connection: Connection | null) {
    return disconnect(connection)
  },

  /**
   * Send the given data to the url, and return status and data.
   * This is used for both retrieving and sending data, and Integreat will
   * handle the preparation of the sent and the retrieved data.
   *
   * If an auth strategy is provided, authorization is attempted if not already
   * authenticated, and a successfull authentication is required before sending
   * the data with auth headers from the auth strategy.
   */
  async send(exchange, connection) {
    return send(exchange, connection)
  },
}

export default mongodbTransporter
