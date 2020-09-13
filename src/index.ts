import mongodb = require('mongodb')
import connect from './connect'
import send from './send'
import { Transporter, Connection, Exchange } from 'integreat'

export interface MongoOptions extends Record<string, unknown> {
  uri?: string
  baseUri?: string
  db?: string
  collection?: string
  sort?: Record<string, number>
  query?: { path: string; param?: string; value?: unknown }[]
}

export interface MongoConnection extends Connection {
  client?: mongodb.MongoClient
}

export interface ExchangeRequest {
  type?: string | string[]
  id?: string | string[]
  pageSize?: number
  pageAfter?: string
  params?: Record<string, unknown>
}

/**
 * MongoDB Transporter for Integreat
 */
const mongodbTransporter: Transporter = {
  authentication: '', // TODO: Change to null after updating type in Integreat

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
  async connect(options, _auth, connection: MongoConnection | null) {
    return connect(mongodb.MongoClient, options, connection)
  },

  /**
   * Disconnect from the source if relevant. The method is given the return
   * value from the connect method.
   */
  async disconnect(connection: MongoConnection | null) {
    if (connection && connection.status === 'ok' && connection.client?.close) {
      connection.client.close()
    }
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
  async send(exchange: Exchange, connection) {
    return send(exchange, connection)
  },
}

export default mongodbTransporter
