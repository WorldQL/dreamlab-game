import type { RenderTime } from '@dreamlab.gg/core'
import { Entity, Game } from '@dreamlab.gg/core'
// import { createEntity } from '@dreamlab.gg/core'
import type { Camera } from '@dreamlab.gg/core/dist/entities'
import type { InputManager } from '@dreamlab.gg/core/dist/input'
import type { LooseVector } from '@dreamlab.gg/core/dist/math'
import { Vec } from '@dreamlab.gg/core/dist/math'
import { deferUntilPlayer } from '@dreamlab.gg/core/dist/utils'
import type { Debug, Ref } from '@dreamlab.gg/core/dist/utils'
import { game } from '@dreamlab.gg/core/labs'
import type { Vector } from 'matter-js'
import { LOCKED_TAG } from '../editor'
import type { Selector } from './select'

export class Navigator extends Entity {
  #position: Matter.Vector = Vec.create()
  public isDragging = false
  public pressedEntity = false
  public previousCursorPosition: Vector | null | undefined = null
  public isSpacePressed = false

  public constructor(
    public editorEnabled: Ref<boolean>,
    public selector: Selector,
  ) {
    super()
    const _game = game('client')
    if (_game) {
      _game.client.inputs.addListener('Space', this.onSpace)
      const canvas = _game.client.render.canvas
      canvas.addEventListener('wheel', this.onWheel)
      canvas.addEventListener('mousemove', this.onMouseMove)
      canvas.addEventListener('mousedown', this.onMouseDown)
      canvas.addEventListener('mouseup', this.onMouseUp)
      canvas.addEventListener('mouseleave', this.onMouseLeave)
    }
  }

  private readonly onMouseDown = (ev: MouseEvent) => {
    if (!this.editorEnabled.value) return
    if (ev.button === 2 || ev.button === 1 || (ev.button === 0 && this.isSpacePressed)) {
      this.selector.deselect()
      this.isDragging = true
      this.previousCursorPosition = game()?.client?.inputs.getCursor('screen')
    }
  }

  private readonly onMouseMove = () => {
    const _game = game('client')
    if (_game) {
      if (!this.isDragging || !this.previousCursorPosition) return

      const mousePosition = game()?.client?.inputs.getCursor('screen')
      if (!mousePosition) return

      const cursorDelta = Vec.sub(this.previousCursorPosition, mousePosition)
      const amplifiedMovement = Vec.div(cursorDelta, _game.client.render.camera.scale)
      const newPosition = Vec.add(this.position(), amplifiedMovement)

      _game.client.render.camera.target = {
        position: newPosition,
      }

      this.previousCursorPosition = mousePosition
      this.setPosition(newPosition)
    }
  }

  private readonly onWheel = (ev: WheelEvent) => {
    if (!this.editorEnabled.value || ev.ctrlKey) return
    const _game = game('client')
    if (!_game) {
      return
    }

    ev.preventDefault()
    const amplifiedMovement = Vec.div(
      Vec.create(ev.deltaX, ev.deltaY),
      _game.client.render.camera.scale,
    )
    if (ev.shiftKey) {
      // swap the X and Y values so that it scrolls like Figma
      const tempX = amplifiedMovement.x
      amplifiedMovement.x = amplifiedMovement.y
      amplifiedMovement.y = tempX
    }

    const newPosition = Vec.add(this.position(), amplifiedMovement)

    _game.client.render.camera.target = { position: newPosition }
    this.setPosition(newPosition)
  }

  private readonly onMouseUp = () => {
    this.isDragging = false
    this.pressedEntity = false
    this.previousCursorPosition = null
  }

  private readonly onMouseLeave = () => {
    this.isDragging = false
    this.previousCursorPosition = null
  }

  private readonly onSpace = (pressed: boolean) => {
    this.isSpacePressed = pressed
  }

  public setPosition(newPosition: Vector) {
    this.#position = Vec.clone(newPosition)
  }

  public position(): Vector {
    return Vec.clone(this.#position)
  }

  public override onRenderFrame({ delta }: RenderTime): void {
    const _game = game('client')
    if (!_game) {
      return
    }

    if (this.editorEnabled.value) {
      const cursorPosition = _game.client.inputs.getCursor()
      let cursorStyle = 'default'

      if (cursorPosition) {
        const query = _game.queryPosition(cursorPosition)
        const queryResults = query.map(({ definition: { tags } }) => tags)
        const isCursorOverNonLockedEntity = queryResults.some(tags => !tags?.includes(LOCKED_TAG))

        if (this.isDragging && !this.pressedEntity) {
          cursorStyle = 'grabbing'
        } else if (this.isSpacePressed) {
          cursorStyle = 'grab'
        } else if (!this.isDragging && isCursorOverNonLockedEntity) {
          cursorStyle = 'pointer'
        }
      }

      _game.client.render.container.style.cursor = cursorStyle
    } else _game.client.render.container.style.cursor = 'default'
  }

  public teardown(): void {
    const _game = game('client')
    if (!_game) {
      return
    }

    const canvas = _game.client.render.canvas
    canvas.removeEventListener('mousedown', this.onMouseDown)
    canvas.removeEventListener('mouseup', this.onMouseUp)
    canvas.removeEventListener('mousemove', this.onMouseMove)
    canvas.removeEventListener('mouseleave', this.onMouseLeave)
    canvas.removeEventListener('wheel', this.onWheel)
    _game.client.inputs.removeListener('Space', this.onSpace)
  }
}
