import { createGame } from '@dreamlab.gg/core'
import { createCursor, PlayerInput } from '@dreamlab.gg/core/entities'
import { calculatePolygons, v } from '@dreamlab.gg/core/math'
import { isDebug } from './debug.js'
import { createEditor } from './editor/editor.js'
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

  const onToggleDebug = (pressed: boolean) => {
    if (!pressed) return
    game.debug.toggle()
  }

  container.append(game.client.render.canvas)
  game.client.inputs.registerInput('debug', 'KeyP')
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

  // TODO: Conditionally enable editor
  const editor = createEditor()
  await game.instantiate(editor)
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
        await loadScript(level, game)
        await spawnPlayer(game, undefined, true)
      }
    }

    // have a dummy level that's like "connect to an instance!!"
    void 0 // temporarily make linter happy, remove when above is implemented
  }

  // TODO: Actually allow rebinding keys
  game.client.inputs.bindInput('Space', PlayerInput.Jump)
  game.client.inputs.bindInput('KeyW', PlayerInput.Jump)

  // await game.spawn({
  //   entity: '@dreamlab/BouncyBall',
  //   args: {
  //     radius: 50,
  //     spriteSource:
  //       'https://cdn.discordapp.com/attachments/441805394323439648/1169068510828306513/Screenshot_20231031_201958_sysui.png?ex=65540ee5&is=654199e5&hm=e3c933515e660a65821214cb5bce8e2ca180fa304b701111ca265f592fc19341&',
  //   },
  //   transform: { rotation: 0, position: [0, 0] },
  // })

  const [center, polygons] = calculatePolygons([
    v([100, 100]),
    v([100, 200]),
    v([300, 100]),
    v([300, 200]),

    v([200, 180]),
    v([200, 20]),
    v([160, 80]),
  ])

  await game.spawn({
    entity: '@dreamlab/ComplexSolid',
    args: { polygon: polygons },
    transform: { position: center },
  })
}
