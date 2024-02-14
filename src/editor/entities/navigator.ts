import type { RenderTime } from '@dreamlab.gg/core'
import { Entity } from '@dreamlab.gg/core'
import { Vec } from '@dreamlab.gg/core/dist/math'
import type { Ref } from '@dreamlab.gg/core/dist/utils'
import { camera, canvas, container, game, inputs } from '@dreamlab.gg/core/labs'
import type { Vector } from 'matter-js'
import { LOCKED_TAG } from '../editor'
import type { Selector } from './select'

export class Navigator extends Entity {
  #position: Matter.Vector = Vec.create()
  #isDragging = false
  #pressedEntity = false
  #previousCursorPosition: Vector | null | undefined = null
  #isSpacePressed = false

  public constructor(
    public editorEnabled: Ref<boolean>,
    public selector: Selector,
  ) {
    super()

    inputs().addListener('Space', this.#onSpace)

    const $canvas = canvas()
    $canvas.addEventListener('wheel', this.#onWheel)
    $canvas.addEventListener('mousemove', this.#onMouseMove)
    $canvas.addEventListener('mousedown', this.#onMouseDown)
    $canvas.addEventListener('mouseup', this.#onMouseUp)
    $canvas.addEventListener('mouseleave', this.#onMouseLeave)
  }

  readonly #onMouseDown = (ev: MouseEvent) => {
    if (!this.editorEnabled.value) return
    if (ev.button === 2 || ev.button === 1 || (ev.button === 0 && this.#isSpacePressed)) {
      this.selector.deselect()
      this.#isDragging = true
      this.#previousCursorPosition = game()?.client?.inputs.getCursor('screen')
    }
  }

  readonly #onMouseMove = () => {
    if (!this.#isDragging || !this.#previousCursorPosition) return

    const mousePosition = game()?.client?.inputs.getCursor('screen')
    if (!mousePosition) return

    const cursorDelta = Vec.sub(this.#previousCursorPosition, mousePosition)
    const amplifiedMovement = Vec.div(cursorDelta, camera().scale)
    const newPosition = Vec.add(this.position(), amplifiedMovement)
    camera().target = { position: newPosition }

    this.#previousCursorPosition = mousePosition
    this.setPosition(newPosition)
  }

  readonly #onWheel = (ev: WheelEvent) => {
    if (!this.editorEnabled.value || ev.ctrlKey) return
    ev.preventDefault()

    const amplifiedMovement = Vec.div(Vec.create(ev.deltaX, ev.deltaY), camera().scale)
    if (ev.shiftKey) {
      // swap the X and Y values so that it scrolls like Figma
      const tempX = amplifiedMovement.x
      amplifiedMovement.x = amplifiedMovement.y
      amplifiedMovement.y = tempX
    }

    const newPosition = Vec.add(this.position(), amplifiedMovement)
    camera().target = { position: newPosition }
    this.setPosition(newPosition)
  }

  readonly #onMouseUp = () => {
    this.#isDragging = false
    this.#pressedEntity = false
    this.#previousCursorPosition = null
  }

  readonly #onMouseLeave = () => {
    this.#isDragging = false
    this.#previousCursorPosition = null
  }

  readonly #onSpace = (pressed: boolean) => {
    this.#isSpacePressed = pressed
  }

  public setPosition(newPosition: Vector) {
    this.#position = Vec.clone(newPosition)
  }

  public position(): Vector {
    return Vec.clone(this.#position)
  }

  public override onRenderFrame(_: RenderTime): void {
    const $game = game('client', true)
    if (this.editorEnabled.value) {
      const cursorPosition = inputs().getCursor()
      let cursorStyle = 'default'

      if (cursorPosition) {
        const query = $game.queryPosition(cursorPosition)
        const queryResults = query.map(({ definition: { tags } }) => tags)
        const isCursorOverNonLockedEntity = queryResults.some(tags => !tags?.includes(LOCKED_TAG))

        if (this.#isDragging && !this.#pressedEntity) {
          cursorStyle = 'grabbing'
        } else if (this.#isSpacePressed) {
          cursorStyle = 'grab'
        } else if (!this.#isDragging && isCursorOverNonLockedEntity) {
          cursorStyle = 'pointer'
        }
      }

      container().style.cursor = cursorStyle
    } else container().style.cursor = 'default'
  }

  public teardown(): void {
    inputs().removeListener('Space', this.#onSpace)

    const $canvas = canvas()
    $canvas.removeEventListener('mousedown', this.#onMouseDown)
    $canvas.removeEventListener('mouseup', this.#onMouseUp)
    $canvas.removeEventListener('mousemove', this.#onMouseMove)
    $canvas.removeEventListener('mouseleave', this.#onMouseLeave)
    $canvas.removeEventListener('wheel', this.#onWheel)
  }
}
