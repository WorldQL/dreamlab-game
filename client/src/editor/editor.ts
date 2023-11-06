import { createEntity } from '@dreamlab.gg/core'
import { createEntitySelect } from './select'

enum EditorInputs {
  Toggle = '@editor/Toggle',
}

export const createEditor = () => {
  const selector = createEntitySelect()
  // TODO: Implement the rest of the editor

  return createEntity({
    async init({ game }) {
      await game.instantiate(selector)

      const toggleEditor = (pressed: boolean) => {
        if (!pressed) return

        if (game.physics.running) game.physics.suspend()
        else game.physics.resume()
      }

      const inputs = game.client?.inputs
      inputs?.registerInput(EditorInputs.Toggle, 'KeyK')
      inputs?.addListener(EditorInputs.Toggle, toggleEditor)

      return { game, toggleEditor }
    },

    initRenderContext(_init, _render) {
      // No-op
      return {}
    },

    async teardown({ game, toggleEditor }) {
      const inputs = game.client?.inputs
      inputs?.removeListener(EditorInputs.Toggle, toggleEditor)

      await game.destroy(selector)
    },

    teardownRenderContext() {
      // No-op
    },
  })
}
