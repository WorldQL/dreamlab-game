import type { Game } from '@dreamlab.gg/core'
import { Player } from '@dreamlab.gg/core/entities'
import type { Vector } from '@dreamlab.gg/core/math'
import { LevelSchema } from '@dreamlab.gg/core/sdk'
import { getParams } from './params'

export const loadScript = async (
  baseURL: string | undefined,
  world: string,
  variant: string,
  game: Game<false>,
): Promise<void> => {
  const module: unknown =
    baseURL === undefined
      ? await import(/* @vite-ignore */ `/worlds/${world}/client.${variant}.bundled.js`)
      : await import(/* @vite-ignore */ `${baseURL}/client.${variant}.bundled.js`)

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
  const characterId = getParams()?.playerInfo?.characterId
  const player = new Player(characterId)

  game.client.render.camera.target = player
  game.client.render.camera.defaultPlayerEntity = player
  if (position) player.teleport(position, true)

  game.instantiate(player)

  return player
}
