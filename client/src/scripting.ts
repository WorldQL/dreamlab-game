import type { Game } from '@dreamlab.gg/core'
import { PlayerInventory } from '@dreamlab.gg/core/dist/managers'
import { createPlayer } from '@dreamlab.gg/core/entities'
import type { Vector } from '@dreamlab.gg/core/math'
import { getCharacterID, loadAnimations } from './animations.js'
import { getObjects } from './playerData.js'

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
  const fetchedObjects = await getObjects()
  const inventory = new PlayerInventory()
  inventory.setObjects(fetchedObjects)
  const player = createPlayer(animations, inventory)
  await game.instantiate(player)

  if (position) player.teleport(position, true)
  game.client.render.camera.setTarget(player)
}
