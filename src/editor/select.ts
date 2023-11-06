import { createEntity } from '@dreamlab.gg/core'
import type { SpawnableEntity } from '@dreamlab.gg/core'
import {
  angleBetween,
  distance,
  snap,
  snapVector,
  toDegrees,
  toRadians,
  Vec,
} from '@dreamlab.gg/core/math'
import type { Vector } from '@dreamlab.gg/core/math'
import { drawBox, drawCircle } from '@dreamlab.gg/core/utils'
import { Container, Graphics } from 'pixi.js'

type ActionData =
  | { type: 'clear' }
  | { type: 'rotate' }
  | { type: 'translate'; origin: Vector }

export const createEntitySelect = () => {
  const colour = '#22a2ff'
  const strokeWidth = 2
  const handleSize = 10
  const rotStalkHeight = 30

  let selected: SpawnableEntity | undefined
  let action: ActionData | undefined

  const onMouseUp = () => {
    if (action !== undefined) action = { type: 'clear' }
  }

  return createEntity({
    init({ game }) {
      return { debug: game.debug }
    },

    initRenderContext({ game }, { canvas, stage, camera }) {
      type Handle = 'rotation' | `${'bottom' | 'top'}${'Left' | 'Right'}`
      const isHandle = (point: Vector): Handle | undefined => {
        const bounds = selected?.rectangleBounds()
        if (!selected || !bounds) return undefined

        const distanceTest = handleSize * 1.5
        const { width, height } = bounds
        const angle = toRadians(selected.transform.rotation)

        // TODO: Correct for camera scale

        const topLeft = Vec.rotateAbout(
          {
            x: selected.transform.position.x - width / 2 - strokeWidth / 2,
            y: selected.transform.position.y - height / 2 - strokeWidth / 2,
          },
          angle,
          selected.transform.position,
        )

        const topRight = Vec.rotateAbout(
          {
            x: selected.transform.position.x + width / 2 + strokeWidth / 2,
            y: selected.transform.position.y - height / 2 - strokeWidth / 2,
          },
          angle,
          selected.transform.position,
        )

        const bottomLeft = Vec.rotateAbout(
          {
            x: selected.transform.position.x - width / 2 - strokeWidth / 2,
            y: selected.transform.position.y + height / 2 + strokeWidth / 2,
          },
          angle,
          selected.transform.position,
        )

        const bottomRight = Vec.rotateAbout(
          {
            x: selected.transform.position.x + width / 2 + strokeWidth / 2,
            y: selected.transform.position.y + height / 2 + strokeWidth / 2,
          },
          angle,
          selected.transform.position,
        )

        const rotation = Vec.rotateAbout(
          {
            x: selected.transform.position.x,
            y: selected.transform.position.y - height / 2 - rotStalkHeight,
          },
          angle,
          selected.transform.position,
        )

        if (distance(topLeft, point) <= distanceTest) return 'topLeft'
        if (distance(topRight, point) <= distanceTest) return 'topRight'
        if (distance(bottomLeft, point) <= distanceTest) return 'bottomLeft'
        if (distance(bottomRight, point) <= distanceTest) return 'bottomRight'
        if (distance(rotation, point) <= distanceTest) return 'rotation'
      }

      const updateCursor = (point: Vector) => {
        const validHover =
          selected &&
          (selected.isPointInside(point) ||
            isHandle(point) !== undefined ||
            (action !== undefined && action.type !== 'clear'))

        canvas.style.cursor = validHover ? 'pointer' : ''
      }

      const onClick = (ev: MouseEvent) => {
        const pos = camera.localToWorld({ x: ev.offsetX, y: ev.offsetY })
        const query = game.queryPosition(pos)

        // TODO: Sort based on Z-index
        const prev = selected
        selected =
          action?.type === 'clear'
            ? selected
            : query.length > 0
            ? query[0]
            : isHandle(pos)
            ? selected
            : undefined

        if (selected !== prev) {
          if (prev) game.physics.resume(prev)
          if (selected) game.physics.suspend(selected)
        }

        updateCursor(pos)
        if (action?.type === 'clear') action = undefined

        // @ts-expect-error global assign in dev
        if (import.meta.env.DEV) window.entity = selected
      }

      const onMouseDown = (ev: MouseEvent) => {
        const pos = camera.localToWorld({ x: ev.offsetX, y: ev.offsetY })
        if (!selected) return

        const handle = isHandle(pos)
        if (handle === 'rotation') {
          action = { type: 'rotate' }
        } else if (handle) {
          // TODO: Scale
        } else if (selected.isPointInside(pos)) {
          action = {
            type: 'translate',
            origin: Vec.sub(selected.transform.position, pos),
          }
        }
      }

      const onMouseMove = () => {
        const pos = game.client.inputs.getCursor()
        if (!pos) return
        updateCursor(pos)

        if (!selected || !action) return
        const shift = game.client.inputs.getKey('ShiftLeft')

        if (action.type === 'rotate') {
          const radians = angleBetween(selected.transform.position, pos)
          const degrees = toDegrees(radians + Math.PI / 2)

          const angle = shift ? snap(degrees, 15) : degrees
          selected.transform.rotation = angle
        } else if (action.type === 'translate') {
          const offset = Vec.add(pos, action.origin)
          const newPosition = shift ? snapVector(offset, 10) : offset

          selected.transform.position.x = newPosition.x
          selected.transform.position.y = newPosition.y
        }
      }

      canvas.addEventListener('click', onClick)
      canvas.addEventListener('mousedown', onMouseDown)
      canvas.addEventListener('mouseup', onMouseUp)
      // canvas.addEventListener('mousemove', onMouseMove)

      const container = new Container()
      container.sortableChildren = true
      container.zIndex = 999_999_999 // always render on top

      const boundsGfx = new Graphics()
      const topLeftGfx = new Graphics()
      const topRightGfx = new Graphics()
      const bottomLeftGfx = new Graphics()
      const bottomRightGfx = new Graphics()
      const rotStalkGfx = new Graphics()
      const rotHandleGfx = new Graphics()

      stage.addChild(container)
      container.addChild(boundsGfx)
      container.addChild(topLeftGfx)
      container.addChild(topRightGfx)
      container.addChild(bottomLeftGfx)
      container.addChild(bottomRightGfx)
      container.addChild(rotStalkGfx)
      container.addChild(rotHandleGfx)

      return {
        canvas,
        camera,
        container,
        boundsGfx,
        topLeftGfx,
        topRightGfx,
        bottomLeftGfx,
        bottomRightGfx,
        rotStalkGfx,
        rotHandleGfx,
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
      // onMouseMove,
    }) {
      canvas.removeEventListener('click', onClick)
      canvas.removeEventListener('mousedown', onMouseDown)
      canvas.removeEventListener('mouseup', onMouseUp)
      // canvas.removeEventListener('mousemove', onMouseMove)

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
        rotStalkGfx,
        rotHandleGfx,
        onMouseMove,
      },
    ) {
      onMouseMove()

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

      const handlesRender = {
        stroke: colour,
        strokeWidth: scaledWidth,
        fill: 'white',
        fillAlpha: 1,
      }

      // #region Scale Handles
      const handlesSize = {
        width: handleSize * inverse,
        height: handleSize * inverse,
      }

      drawBox(topLeftGfx, handlesSize, handlesRender)
      drawBox(topRightGfx, handlesSize, handlesRender)
      drawBox(bottomLeftGfx, handlesSize, handlesRender)
      drawBox(bottomRightGfx, handlesSize, handlesRender)

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
      // #endregion

      // #region Rotation Handle
      const scaledStalkHeight = Math.min(
        rotStalkHeight * inverse,
        rotStalkHeight,
      )

      drawBox(
        rotStalkGfx,
        {
          width: scaledWidth,
          height: scaledStalkHeight,
        },
        { fill: colour, fillAlpha: 1, strokeAlpha: 0 },
      )

      drawCircle(
        rotHandleGfx,
        { radius: (handleSize / 1.75) * inverse },
        handlesRender,
      )

      rotStalkGfx.position.y = -height / 2 - scaledStalkHeight / 2
      rotHandleGfx.position.y = -height / 2 - scaledStalkHeight
      // #endregion
    },
  })
}
