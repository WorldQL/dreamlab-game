import { createEntity } from '@dreamlab.gg/core'
import { createEntitySelect } from './select'

export const createEditor = () => {
  const selector = createEntitySelect()
  // TODO: Implement the rest of the editor

  return createEntity({
    async init({ game }) {
      await game.instantiate(selector)
      return { game }
    },

    initRenderContext(_init, _render) {
      // No-op
      return {}
    },

    async teardown({ game }) {
      await game.destroy(selector)
    },

    teardownRenderContext() {
      // No-op
    },
  })
}
