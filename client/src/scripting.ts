import type { Game } from '@dreamlab.gg/core'
import { createPlayer } from '@dreamlab.gg/core/entities'
import type { Vector } from '@dreamlab.gg/core/math'
import { getCharacterID, loadAnimations } from './animations.js'

export const loadScript = async (
  world: string,
  game: Game<false>,
): Promise<void> => {
  const module: unknown = await import(
    /* @vite-ignore */ `/worlds/${world}/client.js`
  )

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
}
