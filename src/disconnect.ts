import { MongoConnection } from '.'

export default async function disconnect(
  connection: MongoConnection | null
): Promise<void> {
  if (connection?.status === 'ok' && connection.client) {
    connection.client.close()
  }
}
