import type { Entity, Game } from '@dreamlab.gg/core'
import { createEntity } from '@dreamlab.gg/core'
import type { Camera } from '@dreamlab.gg/core/dist/entities'
import type { InputManager } from '@dreamlab.gg/core/dist/input'
import type { LooseVector } from '@dreamlab.gg/core/dist/math'
import { Vec } from '@dreamlab.gg/core/dist/math'
import type { Debug, Ref } from '@dreamlab.gg/core/dist/utils'
import type { Vector } from 'matter-js'
import type { Selector } from './select'

interface Data {
  game: Game<false>
  debug: Debug
}

interface Render {
  game: Game<false>
  canvas: HTMLCanvasElement
  camera: Camera
  inputs: InputManager
  onMouseDown(ev: MouseEvent): void
  onMouseMove(): void
}

export interface Navigator extends Entity<Data, Render> {
  setPosition(position: LooseVector | Vector): void
  get position(): Vector
}

export const createNavigator = (
  editorEnabled: Ref<boolean>,
  selector: Selector,
) => {
  let _position = Vec.create()
  let isDragging = false
  let pressedEntity = false
  let previousCursorPosition: Vector | null | undefined = null

  const onMouseUp = () => {
    isDragging = false
    pressedEntity = false
    previousCursorPosition = null
  }

  const onMouseLeave = () => {
    isDragging = false
    previousCursorPosition = null
  }

  const navigator: Navigator = createEntity({
    setPosition(newPosition: Vector) {
      _position = Vec.clone(newPosition)
    },

    get position(): Vector {
      return Vec.clone(_position)
    },

    async init({ game }) {
      return { game, debug: game.debug }
    },

    async initRenderContext({ game }, { canvas }) {
      const camera = game.client.render.camera
      const inputs = game.client.inputs

      const onMouseDown = () => {
        if (!editorEnabled.value || selector.selected) return
        isDragging = true
        previousCursorPosition = inputs.getCursor('screen')
      }

      const onMouseMove = () => {
        if (!isDragging || !previousCursorPosition) return

        const mousePosition = inputs.getCursor('screen')
        if (!mousePosition) return

        const cursorDelta = Vec.sub(previousCursorPosition, mousePosition)
        const amplifiedMovement = Vec.div(cursorDelta, camera.scale)
        const newPosition = Vec.add(this.position, amplifiedMovement)

        game.client?.render.camera.setTarget({
          position: newPosition,
        })

        previousCursorPosition = mousePosition
        this.setPosition(newPosition)
      }

      canvas.addEventListener('mousemove', onMouseMove)
      canvas.addEventListener('mousedown', onMouseDown)
      canvas.addEventListener('mouseup', onMouseUp)
      canvas.addEventListener('mouseleave', onMouseLeave)

      return {
        game,
        canvas,
        camera,
        inputs: game.client.inputs,
        onMouseDown,
        onMouseMove,
      }
    },

    teardown(_) {
      // No-op
    },

    teardownRenderContext({ canvas, onMouseDown, onMouseMove }) {
      canvas.removeEventListener('mousedown', onMouseDown)
      canvas.removeEventListener('mouseup', onMouseUp)
      canvas.removeEventListener('mousemove', onMouseMove)
      canvas.removeEventListener('mouseleave', onMouseLeave)
    },

    onRenderFrame(_, { game }, { inputs }) {
      if (editorEnabled.value) {
        const cursorPosition = inputs?.getCursor()
        let cursorStyle = 'default'

        if (cursorPosition) {
          const query = game.queryPosition(cursorPosition)
          const queryResults = query.map(({ definition: { tags } }) => tags)
          const isCursorOverNonLockedEntity = queryResults.some(
            tags => !tags?.includes('editorLocked'),
          )

          if (isDragging && !pressedEntity) {
            cursorStyle = 'grabbing'
          } else if (!isDragging && isCursorOverNonLockedEntity) {
            cursorStyle = 'pointer'
          } else if (!isDragging) {
            cursorStyle = 'grab'
          }
        }

        game.client.render.container.style.cursor = cursorStyle
      } else game.client.render.container.style.cursor = 'default'
    },
  })

  return navigator
}
