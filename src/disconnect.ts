import debug = require('debug')
import { Connection } from './types'

const debugMongo = debug('integreat:transporter:mongodb:client')

export default async function disconnect(
  connection: Connection | null
): Promise<void> {
  if (connection?.status === 'ok' && connection.mongo?.client) {
    connection.mongo.count -= 1
    debugMongo(
      `*** MongoDb Client: Disconnecting, count ${connection.mongo.count}`
    )

    if (connection.mongo.count <= 0) {
      connection.mongo.client.close()
    }
  }
}
