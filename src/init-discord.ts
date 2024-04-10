import { DiscordSDK } from '@discord/embedded-app-sdk'
import { z } from 'zod'
import { env } from './env'

const sleep = async (ms: number) =>
  new Promise<void>(resolve => {
    setTimeout(() => resolve(), ms)
  })

const init = async () => {
  const idMatches = /^(?<id>\d+)\.discordsays\.com$/.exec(window.location.host)
  const clientId = idMatches?.groups?.id
  if (!clientId) throw new Error('failed to grab client id from url')

  const loading = document.querySelector('div#loading')! as HTMLDivElement
  const loadingText = document.querySelector('div#loading>span')! as HTMLSpanElement

  loading.style.display = 'flex'

  // @ts-expect-error global
  globalThis.dreamlab_s3_url_base = '/s3'

  const sdk = new DiscordSDK(clientId)
  await sdk.ready()
  await sdk.commands.encourageHardwareAcceleration()

  // TODO: Test App ID mismatch
  const { code } = await sdk.commands.authorize({
    client_id: env.VITE_DISCORD_CLIENT_ID,
    response_type: 'code',
    state: '',
    prompt: 'none',
    scope: ['identify', 'guilds'],
  })

  type AuthRequest = z.infer<typeof AuthRequestSchema>
  const AuthRequestSchema = z.object({
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
    body: JSON.stringify({ instance_id: sdk.instanceId, code } satisfies AuthRequest),
  })

  const { discord_token, dreamlab_token, info } = AuthResponseSchema.parse(await resp.json())
  const auth = await sdk.commands.authenticate({ access_token: discord_token })
  if (auth === null) {
    throw new Error('authenticate command failed')
  }

  while (true) {
    await sleep(500)
    const resp = await fetch(`/mp/api/v1/instance/${info.id}`)
    const json = InstanceInfoSchema.parse(await resp.json())

    if (json.status === 'Started') break
    if (typeof json.status === 'string') loadingText.textContent = `${json.status}...`
  }

  loading.style.display = 'none'
  const { setup } = await import('./game')
  await setup({
    server: `wss://${sdk.clientId}.discordsays.com/mp`,
    instance: info.id as string,
    token: dreamlab_token,
  })
}

void init().catch(console.error)
