import { Entity } from '@dreamlab.gg/core'
import { camera, game, inputs } from '@dreamlab.gg/core/labs'
import { deferUntilPlayer, ref } from '@dreamlab.gg/core/utils'
import type { ToServerPacket } from '../packets'
import type { Action } from './components/history'
import { renderUI } from './components/ui'
import { Navigator } from './entities/navigator'
import { Selector } from './entities/select'

export const LOCKED_TAG = 'editor/locked'

export enum EditorInputs {
  DeleteEntity = '@editor/DeleteEntity',
  MoveBackwards = '@editor/MoveBackwards',
  MoveForewards = '@editor/MoveForewards',
  TogglePalette = '@editor/TogglePalette',
  ToggleTiling = '@editor/ToggleTiling',
}

export interface EditDetails {
  readonly secret: string
  readonly server: string
  readonly instance: string
}

export class Editor extends Entity {
  #enabled = ref<boolean>(false)
  #actionHistory = { value: [] as Action[] }
  #history = {
    record: (action: Action) => {
      this.#actionHistory.value.push(action)
    },
    undo: () => this.#actionHistory.value.pop(),
    getActions: () => this.#actionHistory.value,
  }

  #selector = new Selector(this.#enabled, this.#history, this.sendPacket)
  #navigator = new Navigator(this.#enabled, this.#selector)

  public constructor(
    public sendPacket?: (packet: ToServerPacket) => void,
    public editDetails?: EditDetails,
  ) {
    super()
    const $game = game('client', true)

    $game.instantiate(this.#selector)
    $game.instantiate(this.#navigator)

    inputs().registerInput(EditorInputs.DeleteEntity, 'Delete Entity', 'Backspace')
    inputs().registerInput(EditorInputs.MoveForewards, 'Move Into Foreground', 'BracketRight')
    inputs().registerInput(EditorInputs.MoveBackwards, 'Move Into Background', 'BracketLeft')
    inputs().registerInput(EditorInputs.ToggleTiling, 'Toggle Sprite Tiling', 'Backslash')

    deferUntilPlayer(player => {
      player.events.addListener('onToggleNoclip', noclip => {
        this.#enabled.value = noclip
        if (noclip) {
          camera().smoothing = 0.02
          this.#navigator.setPosition(player.position)
        } else {
          player.teleport(this.#navigator.position())
          camera().target = player
          camera().smoothing = 0.125

          inputs().enable('mouse', 'editor')
          this.#selector.deselect()
          inputs().setKey('MouseLeft', false)
        }
      })
    })

    const { container } = renderUI(this.#selector, this.#navigator, this.#history, editDetails)
    container.style.display = 'none'

    deferUntilPlayer(player => {
      player.events.addListener('onToggleNoclip', noclip => {
        container.style.display = noclip ? '' : 'none'
      })
    })
  }

  public teardown(): void {
    const $game = game('client', true)
    $game.destroy(this.#selector)
    $game.destroy(this.#navigator)
  }
}
