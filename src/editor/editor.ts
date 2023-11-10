import { createEntity } from '@dreamlab.gg/core'
import { deferUntilPlayer, ref } from '@dreamlab.gg/core/utils'
import { renderEditorUI } from './editor-ui'
import { createEntitySelect } from './select'
import { renderUI } from './ui'

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
      inputs?.registerInput(
        EditorInputs.TogglePhysics,
        'Toggle Physics',
        'KeyK',
      )

      inputs?.addListener(EditorInputs.TogglePhysics, togglePhysics)

      deferUntilPlayer(game, player => {
        player.events.addListener('onToggleNoclip', noclip => {
          enabled.value = noclip

          if (noclip) {
            inputs?.disable('mouse', 'editor')
          } else {
            inputs?.enable('mouse', 'editor')
            selector.deselect()
          }
        })
      })

      return { game, togglePhysics }
    },

    initRenderContext({ game }, _render) {
      // eslint-disable-next-line @typescript-eslint/unbound-method
      const { container, unmount } = renderEditorUI(game, selector)
      container.style.display = 'none'

      deferUntilPlayer(game, player => {
        player.events.addListener('onToggleNoclip', noclip => {
          container.style.display = noclip ? '' : 'none'
        })
      })

      return { unmount }
    },

    async teardown({ game, togglePhysics }) {
      const inputs = game.client?.inputs
      inputs?.removeListener(EditorInputs.TogglePhysics, togglePhysics)

      await game.destroy(selector)
    },

    teardownRenderContext({ unmount }) {
      unmount()
    },
  })
}
