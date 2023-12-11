import { createEntity } from '@dreamlab.gg/core'
import { deferUntilPlayer, ref } from '@dreamlab.gg/core/utils'
import type { ToServerPacket } from '../packets'
import { createEntitySelect } from './select'
import { renderUI } from './ui'

export enum EditorInputs {
  DeleteEntity = '@editor/DeleteEntity',
  TogglePalette = '@editor/TogglePalette',
  TogglePhysics = '@editor/TogglePhysics',
}

export const createEditor = (
  sendPacket?: (packet: ToServerPacket) => void,
  scriptEditSecret?: string,
) => {
  const enabled = ref<boolean>(false)
  const selector = createEntitySelect(enabled, sendPacket)
  // TODO: Implement the rest of the editor

  return createEntity({
    async init({ game }) {
      await game.instantiate(selector)

      const togglePhysics = (pressed: boolean) => {
        if (!pressed) return
        game.physics.running = !game.physics.running
      }

      const inputs = game.client?.inputs
      inputs?.registerInput(
        EditorInputs.TogglePhysics,
        'Toggle Physics',
        'KeyK',
      )

      inputs?.registerInput(
        EditorInputs.DeleteEntity,
        'Delete Entity',
        'Backspace',
      )

      inputs?.addListener(EditorInputs.TogglePhysics, togglePhysics)

      deferUntilPlayer(game, player => {
        player.events.addListener('onToggleNoclip', noclip => {
          enabled.value = noclip

          if (!noclip) {
            inputs?.enable('mouse', 'editor')
            selector.deselect()
          }
        })
      })

      return { game, togglePhysics }
    },

    initRenderContext({ game }, _render) {
      const { container, unmount } = renderUI(game, selector, scriptEditSecret)
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
