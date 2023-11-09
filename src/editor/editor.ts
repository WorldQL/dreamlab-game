import { createEntity } from '@dreamlab.gg/core'
import { ref } from '@dreamlab.gg/core/utils'
import { createEntitySelect } from './select'

enum EditorInputs {
  TogglePalette = '@editor/TogglePalette',
  TogglePhysics = '@editor/TogglePhysics',
}

export const createEditor = () => {
  const enabled = ref<boolean>(false)
  const selector = createEntitySelect(enabled)
  // TODO: Implement the rest of the editor

  return createEntity({
    async init({ game }) {
      await game.instantiate(selector)

      const togglePhysics = (pressed: boolean) => {
        if (!pressed) return

        if (game.physics.running) game.physics.suspend()
        else game.physics.resume()
      }

      const inputs = game.client?.inputs
      inputs?.registerInput(EditorInputs.TogglePhysics, 'KeyK')
      inputs?.addListener(EditorInputs.TogglePhysics, togglePhysics)

      return { game, togglePhysics }
    },

    initRenderContext(_init, _render) {
      // No-op
      return {}
    },

    async teardown({ game, togglePhysics }) {
      const inputs = game.client?.inputs
      inputs?.removeListener(EditorInputs.TogglePhysics, togglePhysics)

      await game.destroy(selector)
    },

    teardownRenderContext() {
      // No-op
    },
  })
}
