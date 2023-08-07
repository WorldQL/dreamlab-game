import { createGame } from '@dreamlab.gg/core'
import type { Game } from '@dreamlab.gg/core'
import {
  createCursor,
  createInputs,
  createPlayer,
} from '@dreamlab.gg/core/entities'
import { ref } from '@dreamlab.gg/core/utils'
import { getCharacterID, loadAnimations } from './animations.js'
import { isDebug } from './debug.js'
import { defaultInputMap as inputMap, emitter as inputs } from './inputs.js'
import { connect, createNetwork } from './network.js'

export const init = async () => {
  // #region Setup
  const container = document.querySelector<HTMLDivElement>('#app')
  if (!container) throw new Error('missing container')

  const ws = await connect()
  if (!ws) {
    // TODO: Handle ws connect errors and alert user
  }

  const width = 1_600
  const height = width / (16 / 9)

  const gameRef = ref<Game<false> | undefined>(undefined)
  const [netClient, handshake] = createNetwork(ws, gameRef)
  const game = await createGame({
    debug: isDebug(),
    headless: false,
    container,
    dimensions: { width, height },
    network: netClient,
    graphicsOptions: {
      backgroundAlpha: 0,
      antialias: true,
    },
  })

  gameRef.value = game
  const onToggleDebug = (pressed: boolean) => {
    if (!pressed) return
    game.debug.toggle()
  }

  container.append(game.render.canvas)
  inputs.addListener('toggle-debug', onToggleDebug)
  // #endregion

  // #region Automatic Resizing
  const ro = new ResizeObserver(() => {
    const renderScale = container.clientWidth / width
    game.render.camera.rescale({ renderScale })
  })

  ro.observe(container)
  // #endregion

  // #region Utility Entities
  const inputsEntity = createInputs(inputs, inputMap)
  await game.instantiate(inputsEntity)

  const characterID = getCharacterID()
  const animations = await loadAnimations(characterID)
  const player = createPlayer(inputs, animations)
  game.render.camera.setTarget(player)

  const cursor = createCursor()
  await game.instantiate(cursor)
  // #endregion

  if (ws) {
    const handshakePacket = await handshake
    const clientModule = await import(
      `/levels/${handshakePacket.level_id}/client.js`
    )
    await clientModule.init(game)
  } else {
    // have a dummy level that's like "connect to an instance!!"
  }

  await game.instantiate(player)
}
