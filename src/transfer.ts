import { setup } from './game'
import { getParams } from './params'

export const transferToInstance = async (instanceId: string) => {
  const params = getParams()
  const connection = params.connection
  if (connection === undefined) throw new Error('Not connected to any server')

  const currentAppContainer = document.querySelector('#app') as HTMLDivElement
  const newAppContainer = Object.assign(document.createElement('div'), { id: 'app' })
  currentAppContainer.replaceWith(newAppContainer)

  connection.instance = instanceId
  await setup(newAppContainer)
}

export const transferToWorld = async (world: string) => {
  const params = getParams()
  const connection = params.connection
  const playerInfo = params.playerInfo
  if (connection === undefined || playerInfo === undefined)
    throw new Error('Not connected to any server')

  const serverUrl = new URL(connection.server)
  serverUrl.protocol = { wss: 'https', ws: 'http' }[serverUrl.protocol] ?? serverUrl.protocol
  serverUrl.pathname = '/api/v1/derive-instance/' + connection.instance
  serverUrl.search = ''

  const response = await fetch(serverUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${playerInfo.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ world }),
  })
  if (!response.ok) throw new Error('Failed to find or create derivative instance')
  const instanceInfo = await response.json()

  await transferToInstance(instanceInfo.id)
}
