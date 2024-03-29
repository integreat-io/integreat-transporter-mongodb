import mongodb from 'mongodb'
import connect from './connect.js'
import disconnect from './disconnect.js'
import send from './send.js'
import listen from './listen.js'
import { Transporter } from 'integreat'
import type { ServiceOptions, Connection } from './types.js'

/**
 * MongoDB Transporter for Integreat
 */
const mongodbTransporter: Transporter = {
  authentication: 'asObject',

  /**
   * Prepare endpoint options.
   */
  prepareOptions(options: ServiceOptions) {
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
   * Get data from the database, or set, update, or delete data in the database
   * -- depending on the action.
   */
  send,

  /**
   * Return `true` if we should listen to the database for changes, `false` if
   *  not. We simply return `true` if there is an `incoming` options object.
   */
  shouldListen: (options: ServiceOptions) => !!options.incoming,

  /**
   * Listen for changes in the database and dispatch incoming actions when
   * appropriate.
   */
  listen,

  /**
   * Disconnect from the database and any change streams.
   */
  disconnect,
}

export default mongodbTransporter
