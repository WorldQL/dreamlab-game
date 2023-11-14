import { createEntity } from '@dreamlab.gg/core'
import { renderUI } from './ui'

export const createKeybinds = () => {
  return createEntity({
    init(_init) {
      // No-op
    },

    initRenderContext({ game }, _render) {
      const { unmount } = renderUI(game)
      return { unmount }
    },

    teardown(_data) {
      // No-op
    },

    teardownRenderContext({ unmount }) {
      unmount()
    },
  })
}
