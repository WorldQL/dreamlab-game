import { createGame } from '@dreamlab.gg/core'
import { Cursor, PlayerInput } from '@dreamlab.gg/core/entities'
// import { createConsole } from './console/console.js'
import { jwtDecode as decodeJWT } from 'jwt-decode'
import { isDebug } from './debug.js'
import { Editor } from './editor/editor.js'
// import { createKeybinds } from './keybinds/entity.js'
import { bindInput, loadBindings } from './keybinds/persist.js'
import { renderKeybindUI } from './keybinds/ui.js'
import { connect, createNetwork } from './network.js'
import type { ToServerPacket } from './packets.js'
import { loadLevel, loadScript, spawnPlayer } from './scripting.js'

declare global {
  interface Window {
    // TODO: Make this slightly more hidden lol
    sendPacket?(this: void, packet: ToServerPacket): void
  }
}

const decodeToken = (token: string | undefined) => {
  if (!token) return undefined

  const jwt = decodeJWT(token)
  if (jwt === null || jwt === undefined) return undefined
  if (typeof jwt !== 'object') return undefined

  if (!('player_id' in jwt)) return undefined
  if (typeof jwt.player_id !== 'string') return undefined

  if (!('nickname' in jwt)) return undefined
  if (typeof jwt.nickname !== 'string') return undefined

  return {
    token,
    playerId: jwt.player_id,
    nickname: jwt.nickname,
  }
}

export const setup = async ({
  server,
  instance,
  token,
}: {
  readonly server: string
  readonly instance: string
  readonly token: string | undefined
}) => {
  // #region Setup
  const container = document.querySelector<HTMLDivElement>('#app')
  if (!container) throw new Error('missing container')

  const details = decodeToken(token)
  const ws = details ? await connect({ server, instance, token: details.token }) : undefined

  const worldDetails = localStorage.getItem('@dreamlab/worlds/fallbackUrl')
  if (details && !ws && worldDetails) {
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
    debug: isDebug(),
    isServer: false,
    container,
    dimensions: { width, height },
    data: {
      playerID: details?.playerId ?? 'unknown',
      nickname: details?.nickname ?? 'Player',
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
    const [network, sendPacket, connected] = createNetwork({ server, instance, ws, game })
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
