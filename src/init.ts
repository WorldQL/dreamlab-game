import { getParams } from './params'
import { decodeToken } from './token'

const init = async () => {
  const url = new URL(window.location.href)

  const server = url.searchParams.get('server')
  const instance = url.searchParams.get('instance')
  const token = url.searchParams.get('token')

  if (!server) throw new Error('missing server param')
  if (!instance) throw new Error('missing instance param')
  if (!token) throw new Error('missing token param')

  const params = getParams()
  params.connection = {
    server,
    instance,
  }
  const playerDetails = decodeToken(token)
  if (!playerDetails) throw new Error('invalid token param')
  params.playerInfo = {
    characterId: url.searchParams.get('characterId') ?? undefined,
    ...playerDetails,
  }

  const { setup } = await import('./game')
  await setup()
}

void init().catch(console.error)
export {}
