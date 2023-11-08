import type { Game } from '@dreamlab.gg/core'
import { createPlayer } from '@dreamlab.gg/core/entities'
import type { Vector } from '@dreamlab.gg/core/math'
import { getCharacterID, loadAnimations } from './animations.js'

export const loadScript = async (
  baseURL: string | undefined,
  world: string,
  game: Game<false>,
): Promise<void> => {
  const scriptURL =
    baseURL === undefined
      ? `/worlds/${world}/client.js`
      : `${baseURL}/worlds/${world}/client.js`

  const module: unknown = await import(/* @vite-ignore */ scriptURL)

  if (module === undefined) return
  if (module === null) return
  if (typeof module !== 'object') return

  if ('init' in module && typeof module.init === 'function') {
    await module.init(game)
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
