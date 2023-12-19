import type { LooseSpawnableDefinition } from '@dreamlab.gg/core'
import { createEntity } from '@dreamlab.gg/core'
import { deferUntilPlayer, ref } from '@dreamlab.gg/core/utils'
import type { ToServerPacket } from '../packets'
import { createNavigator } from './navigator'
import { createEntitySelect } from './select'
import { renderUI } from './ui'

export enum EditorInputs {
  DeleteEntity = '@editor/DeleteEntity',
  MoveBackwards = '@editor/MoveBackwards',
  MoveForewards = '@editor/MoveForewards',
  TogglePalette = '@editor/TogglePalette',
  TogglePhysics = '@editor/TogglePhysics',
  ToggleTiling = '@editor/ToggleTiling',
}

export interface EditDetails {
  readonly secret: string
  readonly server: string
  readonly instance: string
}

interface CreateAction {
  type: 'create'
  uid: string
}

interface DeleteAction {
  type: 'delete'
  definition: LooseSpawnableDefinition
}

export type Action = CreateAction | DeleteAction

export const createEditor = (
  sendPacket?: (packet: ToServerPacket) => void,
  editDetails?: EditDetails,
) => {
  const enabled = ref<boolean>(false)
  const selector = createEntitySelect(enabled, sendPacket)
  const navigator = createNavigator(enabled, selector)
  const actionHistory = { value: [] as Action[] }

  const history = {
    record: (action: Action) => {
      actionHistory.value.push(action)
    },
    undo: () => {
      actionHistory.value.pop()
    },
    getActions: () => actionHistory.value,
  }

  return createEntity({
    async init({ game }) {
      await game.instantiate(selector)
      await game.instantiate(navigator)

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
        'Delete',
      )

      inputs?.registerInput(
        EditorInputs.MoveForewards,
        'Move Into Foreground',
        'BracketRight',
      )
      inputs?.registerInput(
        EditorInputs.MoveBackwards,
        'Move Into Background',
        'BracketLeft',
      )

      inputs?.registerInput(
        EditorInputs.ToggleTiling,
        'Toggle Sprite Tiling',
        'Backslash',
      )

      inputs?.addListener(EditorInputs.TogglePhysics, togglePhysics)

      deferUntilPlayer(game, player => {
        player.events.addListener('onToggleNoclip', noclip => {
          enabled.value = noclip
          if (noclip) {
            game.client?.render.camera.setSmoothing(0.02)
            navigator.setPosition(player.position)
          } else {
            player.teleport(navigator.position)
            game.client?.render.camera.setTarget(player)
            game.client?.render.camera.setSmoothing(0.125)
            inputs?.enable('mouse', 'editor')
            selector.deselect()
          }
        })
      })

      return { game, togglePhysics }
    },

    initRenderContext({ game }, _render) {
      const { container, unmount } = renderUI(
        game,
        selector,
        history,
        editDetails,
      )
      container.style.display = 'none'

      deferUntilPlayer(game, player => {
        player.events.addListener('onToggleNoclip', noclip => {
          container.style.display = noclip ? '' : 'none'
        })
      })

      deferUntilPlayer(game, player => {
        player.events.addListener('onTeleport', newPosition => {
          if (enabled) navigator.setPosition(newPosition)
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
