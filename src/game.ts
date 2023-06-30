import { createGame, LevelSchema } from '@dreamlab.gg/core'
import {
  createCursor,
  createInputs,
  createPlayer,
} from '@dreamlab.gg/core/entities'
import { loadAnimations } from './animations.js'
import { isDebug } from './debug.js'
import { defaultInputMap as inputMap, emitter as inputs } from './inputs.js'
import TestLevel from './levels/test.json' assert { type: 'json' }
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
  await game.load(LevelSchema.parse(TestLevel))
  // #endregion
}
