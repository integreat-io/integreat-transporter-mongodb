import { Connection } from './types'

export default async function disconnect(
  connection: Connection | null
): Promise<void> {
  if (connection?.status === 'ok' && connection.mongo?.client) {
    connection.mongo.count -= 1

    if (connection.mongo.count <= 0) {
      connection.mongo.client.close()
    }
  }
}
