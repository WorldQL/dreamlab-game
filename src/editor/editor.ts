import type { SpawnableEntity } from '@dreamlab.gg/core'
import { Entity, isSpawnableEntity } from '@dreamlab.gg/core'
import { camera, game, inputs } from '@dreamlab.gg/core/labs'
import { deferUntilPlayer, ref } from '@dreamlab.gg/core/utils'
import type { ToServerPacket } from '../packets'
import { renderUI } from './components/ui'
import { History } from './entities/history'
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

  readonly #history: History
  readonly #selector: Selector
  readonly #navigator: Navigator

  readonly #onTransformChanged = (entity: Entity, noBroadcast?: boolean) => {
    if (noBroadcast) return
    if (!isSpawnableEntity(entity)) return

    window.sendPacket?.({
      t: 'TransformChanged',
      entity_id: entity.uid,
      position: [entity.transform.position.x, entity.transform.position.y],
      rotation: entity.transform.rotation,
      z_index: entity.transform.zIndex,
    })
  }

  readonly #onArgsChanged = (
    entity: SpawnableEntity,
    path: string,
    value: unknown,
    noBroadcast?: boolean,
  ) => {
    if (noBroadcast) return
    window.sendPacket?.({
      t: 'ArgsChanged',
      entity_id: entity.uid,
      path,
      value,
    })
  }

  readonly #onLabelChanged = (entity: SpawnableEntity, label: string | undefined) => {
    window.sendPacket?.({
      t: 'LabelChanged',
      entity_id: entity.uid,
      label,
    })
  }

  readonly #onTagsChanged = (entity: SpawnableEntity, tags: string[]) => {
    window.sendPacket?.({
      t: 'TagsChanged',
      entity_id: entity.uid,
      tags,
    })
  }

  public constructor(sendPacket?: (packet: ToServerPacket) => void, editDetails?: EditDetails) {
    super()
    const $game = game('client', true)

    const selected = ref<SpawnableEntity | undefined>(undefined)

    this.#history = new History({ selected })
    this.#selector = new Selector(selected, this.#enabled, this.#history, sendPacket)
    this.#navigator = new Navigator(this.#enabled, this.#selector)

    $game.instantiate(this.#history)
    $game.instantiate(this.#selector)
    $game.instantiate(this.#navigator)

    $game.events.common.addListener('onTransformChanged', this.#onTransformChanged)
    $game.events.common.addListener('onArgsChanged', this.#onArgsChanged)
    $game.events.common.addListener('onLabelChanged', this.#onLabelChanged)
    $game.events.common.addListener('onTagsChanged', this.#onTagsChanged)

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
          player.teleport(this.#navigator.position)
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
    $game.destroy(this.#navigator)
    $game.destroy(this.#selector)
    $game.destroy(this.#history)

    $game.events.common.removeListener('onTransformChanged', this.#onTransformChanged)
    $game.events.common.removeListener('onArgsChanged', this.#onArgsChanged)
    $game.events.common.removeListener('onLabelChanged', this.#onLabelChanged)
    $game.events.common.removeListener('onTagsChanged', this.#onTagsChanged)
  }
}
