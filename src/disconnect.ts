import debug from 'debug'
import { Connection } from './types.js'

const debugMongo = debug('integreat:transporter:mongodb:client')

export default async function disconnect(
  connection: Connection | null,
): Promise<void> {
  if (connection?.status === 'ok' && connection.mongo?.client) {
    connection.mongo.count -= 1
    debugMongo(
      `*** MongoDb Client: Disconnecting, count ${connection.mongo.count}`,
    )

    if (Array.isArray(connection.incoming?.streams)) {
      const streams = connection.incoming?.streams
      connection.incoming.streams = []
      for (const stream of streams) {
        await stream.close()
      }
      debugMongo(`*** MongoDb Client: ${streams.length} streams closed`)
    }

    if (connection.mongo.count <= 0 && connection.mongo.client) {
      await connection.mongo.client.close()
      connection.mongo.client = null
      debugMongo('*** MongoDb Client: Disconnected')
    }
  }
}
