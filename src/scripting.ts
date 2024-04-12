import type { Game } from '@dreamlab.gg/core'
import { Player } from '@dreamlab.gg/core/entities'
import type { Vector } from '@dreamlab.gg/core/math'
import { LevelSchema } from '@dreamlab.gg/core/sdk'

export const getCharacterId = () => {
  const params = new URLSearchParams(window.location.search)
  const characterId = params.get('characterId')

  return characterId ?? undefined
}

export const loadScript = async (
  baseURL: string | undefined,
  world: string,
  variant: string,
  game: Game<false>,
): Promise<void> => {
  const getBaseUrl = async () => {
    if (baseURL === undefined) return undefined
    if (import.meta.env.MODE !== 'discord') return baseURL

    const { getClientId } = await import('./init-discord')
    const url = new URL(baseURL)
    console.log(url)
    url.protocol = 'https:'
    url.host = `${getClientId()}.discordsays.com`
    url.port = ''
    url.pathname = `/mp${url.pathname}`

    return url.toString()
  }

  const base = await getBaseUrl()
  const module: unknown =
    base === undefined
      ? await import(/* @vite-ignore */ `/worlds/${world}/client.${variant}.bundled.js`)
      : await import(/* @vite-ignore */ `${base}/client.${variant}.bundled.js`)

  if (module === undefined) return
  if (module === null) return
  if (typeof module !== 'object') return

  if ('init' in module && typeof module.init === 'function') {
    await module.init(game)
  }
}

export const loadLevel = async (
  baseURL: string | undefined,
  world: string,
  game: Game<false>,
): Promise<void> => {
  const module: unknown =
    baseURL === undefined
      ? await import(/* @vite-ignore */ `/worlds/${world}/level.js`)
      : await import(/* @vite-ignore */ `${baseURL}/level.js`)

  if (module === undefined) return
  if (module === null) return
  if (typeof module !== 'object') return

  if ('level' in module && Array.isArray(module.level)) {
    const level = LevelSchema.parse(module.level)
    game.spawnMany(...level)
  }
}

export const spawnPlayer = async (game: Game<false>, position?: Vector) => {
  const characterId = getCharacterId()
  const player = new Player(characterId)

  game.client.render.camera.target = player
  game.client.render.camera.defaultPlayerEntity = player
  if (position) player.teleport(position, true)

  game.instantiate(player)

  return player
}
