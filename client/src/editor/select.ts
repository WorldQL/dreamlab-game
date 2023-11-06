import { createEntity } from '@dreamlab.gg/core'
import type { SpawnableEntity } from '@dreamlab.gg/core'
import { Vec } from '@dreamlab.gg/core/math'
import type { Vector } from '@dreamlab.gg/core/math'
import { drawBox } from '@dreamlab.gg/core/utils'
import { Container, Graphics } from 'pixi.js'

export const createEntitySelect = () => {
  const colour = '#22a2ff'
  const strokeWidth = 2
  const squareSize = 10

  let selected: SpawnableEntity | undefined
  let moveOrigin: Vector | undefined

  const onMouseUp = () => {
    moveOrigin = undefined
  }

  return createEntity({
    init({ game }) {
      return { debug: game.debug }
    },

    initRenderContext({ game }, { canvas, stage, camera }) {
      const updateCursor = (point: Vector) => {
        const style = selected && selected.isPointInside(point) ? 'pointer' : ''
        canvas.style.cursor = style
      }

      const onClick = (ev: MouseEvent) => {
        const pos = camera.localToWorld({ x: ev.offsetX, y: ev.offsetY })
        const query = game.queryPosition(pos)

        // TODO: Sort based on Z-index
        selected = query.length > 0 ? query[0] : undefined
        updateCursor(pos)
      }

      const onMouseDown = (ev: MouseEvent) => {
        const pos = camera.localToWorld({ x: ev.offsetX, y: ev.offsetY })
        if (selected && selected.isPointInside(pos)) {
          moveOrigin = Vec.sub(selected.transform.position, pos)
        }
      }

      const onMouseMove = (ev: MouseEvent) => {
        const pos = camera.localToWorld({ x: ev.offsetX, y: ev.offsetY })
        updateCursor(pos)

        if (!selected || !moveOrigin) return
        const offset = Vec.add(pos, moveOrigin)

        const snap: number | undefined = undefined
        const newPosition: Vector = snap
          ? {
              x: Math.round(offset.x / 10) * 10,
              y: Math.round(offset.y / 10) * 10,
            }
          : offset

        selected.transform.position.x = newPosition.x
        selected.transform.position.y = newPosition.y
      }

      canvas.addEventListener('click', onClick)
      canvas.addEventListener('mousedown', onMouseDown)
      canvas.addEventListener('mouseup', onMouseUp)
      canvas.addEventListener('mousemove', onMouseMove)

      const container = new Container()
      container.sortableChildren = true
      container.zIndex = 999_999_999 // always render on top

      const boundsGfx = new Graphics()
      const topLeftGfx = new Graphics()
      const topRightGfx = new Graphics()
      const bottomLeftGfx = new Graphics()
      const bottomRightGfx = new Graphics()

      stage.addChild(container)
      container.addChild(boundsGfx)
      container.addChild(topLeftGfx)
      container.addChild(topRightGfx)
      container.addChild(bottomLeftGfx)
      container.addChild(bottomRightGfx)

      return {
        canvas,
        camera,
        container,
        boundsGfx,
        topLeftGfx,
        topRightGfx,
        bottomLeftGfx,
        bottomRightGfx,
        onClick,
        onMouseDown,
        onMouseMove,
      }
    },

    teardown(_) {
      // No-op
    },

    teardownRenderContext({
      canvas,
      container,
      onClick,
      onMouseDown,
      onMouseMove,
    }) {
      canvas.removeEventListener('click', onClick)
      canvas.removeEventListener('mousedown', onMouseDown)
      canvas.removeEventListener('mouseup', onMouseUp)
      canvas.removeEventListener('mousemove', onMouseMove)

      container.destroy({ children: true })
    },

    onRenderFrame(
      _,
      __,
      {
        camera,
        container,
        boundsGfx,
        topLeftGfx,
        topRightGfx,
        bottomLeftGfx,
        bottomRightGfx,
      },
    ) {
      const bounds = selected?.rectangleBounds()
      if (!selected || !bounds) {
        container.alpha = 0
        return
      }

      const inverse = 1 / camera.scale
      const scaledWidth = strokeWidth * inverse

      const pos = Vec.add(selected.transform.position, camera.offset)
      container.alpha = 1
      container.position = pos
      container.angle = selected.transform.rotation

      const width = bounds.width + scaledWidth * 2
      const height = bounds.height + scaledWidth * 2
      drawBox(
        boundsGfx,
        { width, height },
        { stroke: colour, strokeWidth: scaledWidth },
      )

      const squaresSize = {
        width: squareSize * inverse,
        height: squareSize * inverse,
      }

      const squaresRender = {
        stroke: colour,
        strokeWidth: scaledWidth,
        fill: 'white',
        fillAlpha: 1,
      }

      drawBox(topLeftGfx, squaresSize, squaresRender)
      drawBox(topRightGfx, squaresSize, squaresRender)
      drawBox(bottomLeftGfx, squaresSize, squaresRender)
      drawBox(bottomRightGfx, squaresSize, squaresRender)

      topLeftGfx.position = {
        x: bounds.width / 2 + scaledWidth / 2,
        y: -(bounds.height / 2 + scaledWidth / 2),
      }

      topRightGfx.position = {
        x: -(bounds.width / 2 + scaledWidth / 2),
        y: -(bounds.height / 2 + scaledWidth / 2),
      }

      bottomLeftGfx.position = {
        x: bounds.width / 2 + scaledWidth / 2,
        y: bounds.height / 2 + scaledWidth / 2,
      }

      bottomRightGfx.position = {
        x: -(bounds.width / 2 + scaledWidth / 2),
        y: bounds.height / 2 + scaledWidth / 2,
      }

      const inverseRot = -selected.transform.rotation
      topLeftGfx.angle = inverseRot
      topRightGfx.angle = inverseRot
      bottomLeftGfx.angle = inverseRot
      bottomRightGfx.angle = inverseRot
    },
  })
}
