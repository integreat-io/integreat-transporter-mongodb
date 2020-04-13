// Definitions file for integreat-adapter-mongodb
import { MongoClient } from 'mongodb'

export interface Connection {
  status: string
  error?: string
  client?: MongoClient
}

export interface Response {
  status: string
  error?: string
  data?: object[]
}

export interface Adapter {
  authentication?: string
  prepareEndpoint: (endpointOptions: object, serviceOptions: object) => object
  connect: (options: object, connection: Connection) => Promise<Connection>
  disconnect: (connection: Connection) => Promise<void>
  send: (request: object, connection: Connection) => Promise<object>
  normalize: (data: object[], request: object) => Promise<object[]>
  serialize: (data: object[], request: object) => Promise<object[]>
}

declare const _default: { adapter: Adapter }

export = _default
