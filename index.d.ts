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
  prepareEndpoint: (endpointOptions: object, serviceOptions?: object) => object
  connect: (options: object, auth: object | null, connection: Connection | null) => Promise<Connection>
  disconnect: (connection: Connection | null) => Promise<void>
  send: (request: object, connection: Connection | null) => Promise<object>
  serialize: (request: object) => Promise<object[]>
  normalize: (response: object, request: object) => Promise<object[]>
}

declare const _default: { adapter: Adapter }

export = _default
