import { createGame } from '@dreamlab.gg/core'
import { createCursor, PlayerInput } from '@dreamlab.gg/core/entities'
import { isDebug } from './debug.js'
import { connect, createNetwork } from './network.js'
import { loadScript } from './scripting.js'

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

  const game = await createGame({
    debug: isDebug(),
    headless: false,
    container,
    dimensions: { width, height },
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
  game.inputs.registerInput('debug', 'KeyP')
  game.inputs.addListener('debug', onToggleDebug)
  // #endregion

  // #region Automatic Resizing
  const ro = new ResizeObserver(() => {
    const renderScale = container.clientWidth / width
    game.render.camera.rescale({ renderScale })
  })

  ro.observe(container)
  // #endregion

  // #region Utility Entities
  const cursor = createCursor()
  await game.instantiate(cursor)
  // #endregion

  if (ws) {
    const [network, connected] = createNetwork(ws, game)
    game.initNetwork(network)

    await connected
  } else {
    if (import.meta.env.DEV) {
      const url = new URL(window.location.href)
      const level = url.searchParams.get('level')

      if (level) await loadScript(level, game)
    }

    // have a dummy level that's like "connect to an instance!!"
    void 0 // temporarily make linter happy, remove when above is implemented
  }

  // TODO: Actually allow rebinding keys
  game.inputs.bindInput('Space', PlayerInput.Jump)
  game.inputs.bindInput('KeyW', PlayerInput.Jump)
}
