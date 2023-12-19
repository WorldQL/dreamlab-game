import type { Entity, Game } from '@dreamlab.gg/core'
import { createEntity } from '@dreamlab.gg/core'
import type { Camera } from '@dreamlab.gg/core/dist/entities'
import type { LooseVector } from '@dreamlab.gg/core/dist/math'
import { Vec } from '@dreamlab.gg/core/dist/math'
import type { Debug, Ref } from '@dreamlab.gg/core/dist/utils'
import type { Vector } from 'matter-js'

interface Data {
  game: Game<false>
  debug: Debug
}

interface Render {
  game: Game<false>
  canvas: HTMLCanvasElement
  camera: Camera
  onMouseDown(ev: MouseEvent): void
  onMouseMove(): void
  onMouseLeave(): void
  onMouseUp(ev: MouseEvent): void
}

export interface Navigator extends Entity<Data, Render> {
  setPosition(position: LooseVector | Vector): void
  get position(): Vector
}

export const createNavigator = (editorEnabled: Ref<boolean>) => {
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

      const onMouseDown = (ev: MouseEvent) => {
        if (!editorEnabled.value) return
        const pos = camera.screenToWorld({ x: ev.offsetX, y: ev.offsetY })
        const query = game.queryPosition(pos)
        pressedEntity = query.length > 0
        if (!pressedEntity) {
          isDragging = true
          previousCursorPosition = inputs.getCursor('screen')
        }
      }

      const onMouseMove = () => {
        if (!isDragging || !previousCursorPosition) return

        const mousePosition = inputs.getCursor('screen')
        if (!mousePosition) return

        const cursorDelta = Vec.sub(previousCursorPosition, mousePosition)
        const amplifiedMovement = Vec.div(cursorDelta, camera.scale)
        const newPosition = Vec.add(this.position, amplifiedMovement)

        this.setPosition(newPosition)
        game.client?.render.camera.setTarget({
          position: newPosition,
        })
        previousCursorPosition = mousePosition
      }

      canvas.addEventListener('mousemove', onMouseMove)
      canvas.addEventListener('mousedown', onMouseDown)
      canvas.addEventListener('mouseup', onMouseUp)
      canvas.addEventListener('mouseleave', onMouseLeave)

      return {
        game,
        canvas,
        camera,
        onMouseDown,
        onMouseMove,
        onMouseUp,
        onMouseLeave,
      }
    },

    teardown(_) {
      // No-op
    },

    teardownRenderContext({
      canvas,
      onMouseDown,
      onMouseUp,
      onMouseMove,
      onMouseLeave,
    }) {
      canvas.removeEventListener('mousedown', onMouseDown)
      canvas.removeEventListener('mouseup', onMouseUp)
      canvas.removeEventListener('mousemove', onMouseMove)
      canvas.removeEventListener('mouseleave', onMouseLeave)
    },
  })

  return navigator
}
