import { Connection } from '.'

export default async function disconnect(
  connection: Connection | null
): Promise<void> {
  if (connection?.status === 'ok' && connection.client) {
    connection.client.close()
  }
}
