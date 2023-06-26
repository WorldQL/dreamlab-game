import { createGame } from '@dreamlab.gg/core'
import { createCursor } from '@dreamlab.gg/core/dist/entities'
import { isDebug } from './debug.js'

export const init = async () => {
  const container = document.querySelector<HTMLDivElement>('#app')
  if (!container) throw new Error('missing container')

  const game = await createGame({
    debug: isDebug(),
    headless: false,
    container,
    dimensions: { width: 1_600, height: 900 },
    graphicsOptions: {
      backgroundAlpha: 0,
      antialias: true,
    },
  })

  container.append(game.render.canvas)

  const cursor = createCursor()
  await game.instantiate(cursor)

  await game.spawn({
    entityFn: 'createSolid',
    args: [100, 100],
    transform: { position: [0, 0] },
  })
}
