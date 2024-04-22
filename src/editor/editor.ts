import type { SpawnableEntity } from '@dreamlab.gg/core'
import { Entity, isSpawnableEntity } from '@dreamlab.gg/core'
import { Player } from '@dreamlab.gg/core/dist/entities'
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
  #hideUIElements = ref<boolean>(true)

  readonly #history: History
  readonly #selector: Selector
  readonly #navigator: Navigator

  readonly #onTransformChanged = (entity: Entity, noBroadcast?: boolean) => {
    if (noBroadcast) return
    if (!isSpawnableEntity(entity)) return
    if (entity !== this.#selector.selected) return

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
    if (entity !== this.#selector.selected) return

    window.sendPacket?.({
      t: 'ArgsChanged',
      entity_id: entity.uid,
      path,
      value,
    })
  }

  readonly #onLabelChanged = (entity: SpawnableEntity, label: string | undefined) => {
    if (entity !== this.#selector.selected) return

    window.sendPacket?.({
      t: 'LabelChanged',
      entity_id: entity.uid,
      label,
    })
  }

  readonly #onTagsChanged = (entity: SpawnableEntity, tags: string[]) => {
    if (entity !== this.#selector.selected) return

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

    const { ui, debug_ui } = renderUI(
      this.#selector,
      this.#navigator,
      this.#history,
      this.#hideUIElements.value,
      (checked: boolean) => {
        this.#hideUIElements.value = checked
        this.toggleUIElements(ui.root, this.#hideUIElements.value)
      },
      editDetails,
    )
    ui.container.style.display = 'none'
    debug_ui.container.style.display = debug() ? '' : 'none'

    inputs().addListener(EditorInputs.ToggleEditor, (keyDown: boolean) => {
      if (!keyDown) {
        return
      }

      this.#enabled.value = !this.#enabled.value
      const currentTarget = camera().target
      let targetPos: Vector | undefined

      ui.container.style.display = this.#enabled.value ? '' : 'none'
      debug_ui.container.style.display = this.#enabled.value ? 'none' : ''

      if (currentTarget) {
        if ('position' in currentTarget) {
          targetPos = currentTarget.position
        } else if ('transform' in currentTarget) {
          targetPos = currentTarget.transform.position
        }
      }

      if (this.#enabled.value) {
        this.toggleUIElements(ui.root, this.#hideUIElements.value)
        camera().target = this.#navigator
        camera().smoothing = 0.02
        inputs().disable('mouse', 'editor')
        inputs().disableNonEditorInputs()
        if (targetPos) {
          this.#navigator.setPosition(targetPos)
        }
      } else {
        this.toggleUIElements(ui.root, false)

        inputs().enableNonEditorInputs()
        if (camera().defaultPlayerEntity instanceof Player) {
          ;(camera().defaultPlayerEntity as Player).teleport(this.#navigator.position)
        } else if (isSpawnableEntity(camera().defaultPlayerEntity)) {
          ;(camera().defaultPlayerEntity as SpawnableEntity).transform.position =
            this.#navigator.position
        }

        camera().target = camera().defaultPlayerEntity
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

  private toggleUIElements(editorRoot: ShadowRoot, hideUI: boolean) {
    if (this.#enabled.value && hideUI) {
      for (const shadowRoot of game('client', true).client.ui.roots) {
        if (shadowRoot === editorRoot) continue

        const existingStyle = shadowRoot.querySelector('style[data-dreamlab-editor]')
        existingStyle?.remove()

        const style = Object.assign(document.createElement('style'), {
          textContent: `* { display: none }`,
        })
        style.dataset.dreamlabEditor = ''
        shadowRoot.append(style)
      }
    } else {
      for (const shadowRoot of game('client', true).client.ui.roots) {
        if (shadowRoot === editorRoot) continue

        const existingStyle = shadowRoot.querySelector('style[data-dreamlab-editor]')
        existingStyle?.remove()
      }
    }
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
