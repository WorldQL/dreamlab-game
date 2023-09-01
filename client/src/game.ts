import { createGame } from '@dreamlab.gg/core'
import { createCursor, PlayerInput } from '@dreamlab.gg/core/entities'
import { TextureManager } from '@dreamlab.gg/core/textures'
import {PlayerDataManager} from '@dreamlab.gg/core/entities'
import { isDebug } from './debug.js'
import { connect, createNetwork } from './network.js'
import { loadScript, spawnPlayer } from './scripting.js'

export const init = async () => {
  // #region Setup
  const container = document.querySelector<HTMLDivElement>('#app')
  if (!container) throw new Error('missing container')

  window.addEventListener('message', ev => {
    window.localStorage.setItem('globalPassedPlayerData', ev.data)
  })

  await TextureManager.loadTexture('https://dreamlab-user-assets.s3.us-east-1.amazonaws.com/path-in-s3/1693339947404.png');
  await TextureManager.loadTexture('https://dreamlab-user-assets.s3.us-east-1.amazonaws.com/path-in-s3/1693261056400.png')
  await TextureManager.loadTexture('https://dreamlab-user-assets.s3.us-east-1.amazonaws.com/path-in-s3/1693240114500.png')
  PlayerDataManager.set('foo', 'bar')


  const ws = await connect()
  if (!ws) {
    console.log('boohoo');
    // TODO: Handle ws connect errors and alert user
  }

  const width = 1_600
  const height = width / (16 / 9)

  const game = await createGame({
    debug: isDebug(),
    isServer: false,
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
        await spawnPlayer(game)
      }
    }

    // have a dummy level that's like "connect to an instance!!"
    void 0 // temporarily make linter happy, remove when above is implemented
  }

  // TODO: Actually allow rebinding keys
  game.client.inputs.bindInput('Space', PlayerInput.Jump)
  game.client.inputs.bindInput('KeyW', PlayerInput.Jump)
}
