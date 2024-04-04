import type { SpawnableEntity } from '@dreamlab.gg/core'
import { Entity, isSpawnableEntity } from '@dreamlab.gg/core'
import type { CameraTarget } from '@dreamlab.gg/core/dist/entities'
import { camera, debug, game, inputs } from '@dreamlab.gg/core/labs'
import { ref } from '@dreamlab.gg/core/utils'
import type { Vector } from 'matter-js'
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
  ToggleEditor = '@editor/ToggleEditor',
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

  private cameraTarget: CameraTarget | undefined

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
    inputs().registerInput(EditorInputs.ToggleEditor, 'Toggle Editor Mode', 'Backquote')

    const { ui, debug_ui } = renderUI(this.#selector, this.#navigator, this.#history, editDetails)
    ui.container.style.display = 'none'
    debug_ui.container.style.display = debug() ? '' : 'none'

    inputs().addListener(EditorInputs.ToggleEditor, (keyDown: boolean) => {
      if (!keyDown) {
        return
      }

      this.#enabled.value = !this.#enabled.value
      const currentTarget = camera().target
      let targetPos: Vector | undefined

      if (currentTarget) {
        if ('position' in currentTarget) {
          targetPos = currentTarget.position
        } else if ('transform' in currentTarget) {
          targetPos = currentTarget.transform.position
        }
      }

      if (this.#enabled.value) {
        this.cameraTarget = currentTarget
        camera().smoothing = 0.02
        inputs().disableNonEditorInputs()
        if (targetPos) {
          this.#navigator.setPosition(targetPos)
        }
      } else {
        inputs().enableNonEditorInputs()
        camera().target = this.cameraTarget
        camera().smoothing = 0.125
        inputs().enable('mouse', 'editor')
        this.#selector.deselect()
        inputs().setKey('MouseLeft', false)
      }
    })

    game().client?.inputs.addListener('debug', () => {
      debug_ui.container.style.display = debug() ? '' : 'none'
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
