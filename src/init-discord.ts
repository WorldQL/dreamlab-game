import { DiscordSDK } from '@discord/embedded-app-sdk'
import { z } from 'zod'
import { getParams } from './params'
import { decodeToken } from './token'

// const sleep = async (ms: number) =>
//   new Promise<void>(resolve => {
//     setTimeout(() => resolve(), ms)
//   })

export const getClientId = () => {
  const idMatches = /^(?<id>\d+)\.discordsays\.com$/.exec(window.location.host)
  const clientId = idMatches?.groups?.id
  if (!clientId) throw new Error('failed to grab client id from url')

  return clientId
}

const init = async () => {
  const clientId = getClientId()

  const loading = document.querySelector('div#loading')! as HTMLDivElement
  const loadingText = document.querySelector('div#loading>span')! as HTMLSpanElement

  loading.style.display = 'flex'

  // @ts-expect-error global
  globalThis.dreamlab_s3_url_base = '/s3'

  const sdk = new DiscordSDK(clientId)
  await sdk.ready()
  await sdk.commands.encourageHardwareAcceleration()

  const { code } = await sdk.commands.authorize({
    client_id: sdk.clientId,
    response_type: 'code',
    state: '',
    prompt: 'none',
    scope: ['identify', 'guilds'],
  })

  type AuthRequest = z.infer<typeof AuthRequestSchema>
  const AuthRequestSchema = z.object({
    application_id: z.string().min(1),
    instance_id: z.string().min(1),
    code: z.string().min(1),
  })

  const InstanceInfoSchema = z.record(z.string(), z.unknown())
  const AuthResponseSchema = z.object({
    discord_token: z.string().min(1),
    dreamlab_token: z.string().min(1),
    info: InstanceInfoSchema,
  })

  const resp = await fetch('/mp/api/v1/discord/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      application_id: sdk.clientId,
      instance_id: sdk.instanceId,
      code,
    } satisfies AuthRequest),
  })

  if (!resp.ok) {
    loadingText.textContent = 'Failed to start world.'

    console.log(resp)
    return
  }

  const { discord_token, dreamlab_token, info } = AuthResponseSchema.parse(await resp.json())
  const auth = await sdk.commands.authenticate({ access_token: discord_token })
  if (auth === null) {
    throw new Error('authenticate command failed')
  }

  const params = getParams()
  params.connection = {
    server: `wss://${sdk.clientId}.discordsays.com/mp`,
    instance: info.id as string,
  }
  const playerDetails = decodeToken(dreamlab_token)
  if (!playerDetails) throw new Error('invalid token param')
  params.playerInfo = {
    characterId: new URLSearchParams(window.location.search).get('characterId') ?? undefined,
    ...playerDetails,
  }

  const { setup } = await import('./game')
  await setup()

  loading.style.display = 'none'
}

void init().catch(console.error)
