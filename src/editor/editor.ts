// import { createEntity } from '@dreamlab.gg/core'
import { Entity } from '@dreamlab.gg/core'
import { game } from '@dreamlab.gg/core/labs'
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
  public constructor(
    public sendPacket?: (packet: ToServerPacket) => void,
    public editDetails?: EditDetails,
  ) {
    super()
    const _game = game('client')
    if (!_game) return

    _game.instantiate(this.selector)
    _game.instantiate(this.navigator)

    const inputs = _game.client?.inputs
    inputs?.registerInput(EditorInputs.DeleteEntity, 'Delete Entity', 'Backspace')

    inputs?.registerInput(EditorInputs.MoveForewards, 'Move Into Foreground', 'BracketRight')
    inputs?.registerInput(EditorInputs.MoveBackwards, 'Move Into Background', 'BracketLeft')

    inputs?.registerInput(EditorInputs.ToggleTiling, 'Toggle Sprite Tiling', 'Backslash')

    deferUntilPlayer(_game, player => {
      player.events.addListener('onToggleNoclip', noclip => {
        this.enabled.value = noclip
        if (noclip) {
          _game.client.render.camera.smoothing = 0.02
          this.navigator.setPosition(player.position)
        } else {
          player.teleport(this.navigator.position())
          _game.client.render.camera.target = player
          _game.client.render.camera.smoothing = 0.125
          inputs?.enable('mouse', 'editor')
          this.selector.deselect()
          _game.client?.inputs.setKey('MouseLeft', false)
        }
      })
    })

    const { container } = renderUI(_game, this.selector, this.navigator, this.history, editDetails)
    container.style.display = 'none'

    deferUntilPlayer(_game, player => {
      player.events.addListener('onToggleNoclip', noclip => {
        container.style.display = noclip ? '' : 'none'
      })
    })
  }
  public enabled = ref<boolean>(false)
  public actionHistory = { value: [] as Action[] }
  public history = {
    record: (action: Action) => {
      this.actionHistory.value.push(action)
    },
    undo: () => this.actionHistory.value.pop(),
    getActions: () => this.actionHistory.value,
  }
  public selector = new Selector(this.enabled, this.history, this.sendPacket)
  public navigator = new Navigator(this.enabled, this.selector)

  public teardown(): void {
    game('client')?.destroy(this.selector)
  }
}
