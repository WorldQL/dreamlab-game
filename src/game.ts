import { createGame } from '@dreamlab.gg/core'
import { createCursor, PlayerInput } from '@dreamlab.gg/core/entities'
import { isDebug } from './debug.js'
import { createEditor } from './editor/editor.js'
import { createKeybinds } from './keybinds/entity.js'
import { bindInput, loadBindings } from './keybinds/persist.js'
import { connect, createNetwork, decodeParams } from './network.js'
import { loadScript, spawnPlayer } from './scripting.js'

export const init = async () => {
  // #region Setup
  const container = document.querySelector<HTMLDivElement>('#app')
  if (!container) throw new Error('missing container')

  const params = decodeParams()
  const ws = await connect(params)
  if (!ws) {
    // TODO: Handle ws connect errors and alert user
  }

  const width = 1_600
  const height = width / (16 / 9)

  const game = await createGame({
    debug: isDebug(),
    isServer: false,
    container,
    dimensions: { width, height },
    data: {
      playerID: params?.playerID ?? 'unknown',
      nickname: params?.nickname ?? 'Player',
    },
    graphicsOptions: {
      backgroundAlpha: 0,
      antialias: true,
    },
  })

  // @ts-expect-error global assign in dev
  if (import.meta.env.DEV) window.game = game

  const onToggleDebug = (pressed: boolean) => {
    if (!pressed) return
    game.debug.toggle()
  }

  container.append(game.client.render.canvas)
  game.client.inputs.registerInput('debug', 'Toggle Debug', 'KeyP')
  game.client.inputs.addListener('debug', onToggleDebug)
  // #endregion

  // #region Automatic Resizing
  const ro = new ResizeObserver(() => {
    const renderScale = container.clientWidth / width
    game.client.render.camera.rescale({ renderScale })
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

      if (level) {
        const editor = createEditor()
        await game.instantiate(editor)

        await loadScript(undefined, level, game)
        await spawnPlayer(game, undefined)
      }
    }

    // have a dummy level that's like "connect to an instance!!"
    void 0 // temporarily make linter happy, remove when above is implemented
  }

  loadBindings(game)
  const defaultJumpBindingKey = '@dreamlab/Input/DefaultJumpBound'
  if (localStorage.getItem(defaultJumpBindingKey) === null) {
    localStorage.setItem(defaultJumpBindingKey, 'true')

    bindInput(game, 'Space', PlayerInput.Jump)
    bindInput(game, 'KeyW', PlayerInput.Jump)
  }

  const keybinds = createKeybinds()
  await game.instantiate(keybinds)
}
