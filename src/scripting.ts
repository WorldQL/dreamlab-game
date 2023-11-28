import type { Game } from '@dreamlab.gg/core'
import { createPlayer } from '@dreamlab.gg/core/entities'
import type { Vector } from '@dreamlab.gg/core/math'
import { LevelSchema } from '@dreamlab.gg/core/sdk'
import { getCharacterID, loadAnimations } from './animations.js'

export const loadScript = async (
  baseURL: string | undefined,
  world: string,
  game: Game<false>,
): Promise<void> => {
  const module: unknown =
    baseURL === undefined
      ? await import(/* @vite-ignore */ `/worlds/${world}/client.js`)
      : await import(/* @vite-ignore */ `${baseURL}/client.js`)

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
    await game.spawnMany(...level)
  }
}

export const spawnPlayer = async (game: Game<false>, position?: Vector) => {
  const characterID = getCharacterID()
  const animations = await loadAnimations(characterID)

  const player = createPlayer(animations)
  await game.instantiate(player)

  if (position) player.teleport(position, true)
  game.client.render.camera.setTarget(player)

  return player
}
