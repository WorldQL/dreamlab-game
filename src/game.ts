import { createGame } from '@dreamlab.gg/core'
import {
  createCursor,
  createInputs,
  createPlayer,
} from '@dreamlab.gg/core/entities'
import { loadAnimations } from './animations.js'
import { isDebug } from './debug.js'
import { defaultInputMap as inputMap, emitter as inputs } from './inputs.js'
import { createNetwork } from './network.js'

export const init = async () => {
  // #region Setup
  const container = document.querySelector<HTMLDivElement>('#app')
  if (!container) throw new Error('missing container')

  const game = await createGame({
    debug: isDebug(),
    headless: false,
    container,
    dimensions: { width: 1_600, height: 900 },
    network: createNetwork(),
    graphicsOptions: {
      backgroundAlpha: 0,
      antialias: true,
    },
  })

  const onToggleDebug = (pressed: boolean) => {
    if (!pressed) return
    game.debug.toggle()
  }

  container.append(game.render.canvas)
  inputs.addListener('toggle-debug', onToggleDebug)
  // #endregion

  // #region Utility Entities
  const inputsEntity = createInputs(inputs, inputMap)
  await game.instantiate(inputsEntity)

  const animations = await loadAnimations()
  const player = createPlayer(inputs, animations)
  await game.instantiate(player)
  game.render.camera.setTarget(player)

  const cursor = createCursor()
  await game.instantiate(cursor)
  // #endregion

  // #region Test "Level"
  const height = 250

  await game.spawn({
    entityFn: 'createSolid',
    transform: { position: [0, 30 + height] },
    args: [1_240, 20],
  })

  await game.spawn({
    entityFn: 'createSolid',
    transform: { position: [610, -180 + height] },
    args: [20, 400],
  })

  await game.spawn({
    entityFn: 'createSolid',
    transform: { position: [-610, -180 + height] },
    args: [20, 400],
  })

  await game.spawn({
    entityFn: 'createSolid',
    transform: { position: [-400, -130 + height], rotation: 45 },
    args: [100, 100],
  })

  await game.spawn({
    entityFn: 'createNonsolid',
    transform: { position: [400, -130 + height], rotation: -45 },
    args: [100, 100],
  })
  // #endregion
}
