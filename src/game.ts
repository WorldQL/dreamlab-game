import { createGame } from '@dreamlab.gg/core'
import { Cursor, PlayerInput } from '@dreamlab.gg/core/entities'
// import { createConsole } from './console/console.js'
import { Editor } from './editor/editor.js'
// import { createKeybinds } from './keybinds/entity.js'
import { bindInput, loadBindings } from './keybinds/persist.js'
import { renderKeybindUI } from './keybinds/ui.js'
import { connect, createNetwork } from './network.js'
import type { ToServerPacket } from './packets.js'
import { getParams } from './params.js'
import { loadLevel, loadScript, spawnPlayer } from './scripting.js'

declare global {
  interface Window {
    // TODO: Make this slightly more hidden lol
    sendPacket?(this: void, packet: ToServerPacket): void
  }
}

export const init = async () => {
  // #region Setup
  const container = document.querySelector<HTMLDivElement>('#app')
  if (!container) throw new Error('missing container')

  const params = getParams()

  const ws = await connect()
  const worldDetails = localStorage.getItem('@dreamlab/worlds/fallbackUrl')
  if (params.connection && !ws && worldDetails) {
    console.log('Failed to connect in init()')
    setTimeout(() => {
      window.location.reload()
    }, 1_000)
    window.location.href = worldDetails
    return
  }

  const width = 1_600
  const height = width / (16 / 9)

  const game = await createGame({
    debug: params.debug,
    isServer: false,
    container,
    dimensions: { width, height },
    data: {
      playerID: params.playerInfo?.playerID ?? 'unknown',
      nickname: params.playerInfo?.nickname ?? 'Player',
    },
    graphicsOptions: {
      backgroundAlpha: 0,
      antialias: true,
    },
  })

  renderKeybindUI(game)

  // @ts-expect-error global assign in dev
  window.game = game

  const onToggleDebug = (pressed: boolean) => {
    if (!pressed) return
    game.debug.toggle()
  }

  container.append(game.client.render.canvas)
  game.client.inputs.registerInput('@editor/debug', 'Toggle Debug', 'KeyP')
  game.client.inputs.addListener('@editor/debug', onToggleDebug)
  // #endregion

  // #region Automatic Resizing
  const ro = new ResizeObserver(() => {
    const renderScale = container.clientWidth / width
    game.client.render.camera.rescale({ renderScale })
  })

  ro.observe(container)
  // #endregion

  // #region Utility Entities
  const cursor = new Cursor()
  game.instantiate(cursor)
  // #endregion

  if (ws) {
    const [network, sendPacket, connected] = createNetwork(ws, game)
    game.initNetwork(network)

    await connected
    console.log('connected successfully!')

    game.events.common.on('onTickSkipped', () => {
      sendPacket({ t: 'RequestFullSnapshot' })
    })

    window.sendPacket = sendPacket

    // const serverLog = createConsole(params!.server, params!.instance)
    // game.instantiate(serverLog)
  } else {
    if (import.meta.env.DEV) {
      const url = new URL(window.location.href)
      const world = url.searchParams.get('level')

      if (world) {
        const editor = new Editor(undefined, {
          secret: 'secret',
          server: 'http://localhost',
          instance: 'instance',
        })

        game.instantiate(editor)

        await loadScript(undefined, world, 'main', game)
        await loadLevel(undefined, world, game)
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

  // const keybinds = createKeybinds()
  // game.instantiate(keybinds)
}
