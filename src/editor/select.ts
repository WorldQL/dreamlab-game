import { createEntity } from '@dreamlab.gg/core'
import type { SpawnableEntity } from '@dreamlab.gg/core'
import type { EventHandler } from '@dreamlab.gg/core/events'
import {
  absolute,
  angleBetween,
  distance,
  snap,
  snapVector,
  toDegrees,
  toRadians,
  Vec,
} from '@dreamlab.gg/core/math'
import type { Bounds, Vector } from '@dreamlab.gg/core/math'
import type { Ref } from '@dreamlab.gg/core/utils'
import { drawBox, drawCircle } from '@dreamlab.gg/core/utils'
import { Container, Graphics } from 'pixi.js'

type ActionData =
  | { type: 'clear' }
  | { type: 'rotate' }
  | { type: 'scale'; origin: Vector }
  | { type: 'translate'; origin: Vector }

export const createEntitySelect = (
  editorEnabled: Ref<boolean>,
  selected: Ref<SpawnableEntity | undefined>,
) => {
  const colour = '#22a2ff'
  const strokeWidth = 2
  const handleSize = 10
  const rotStalkHeight = 30

  let action: ActionData | undefined

  const onMouseUp = () => {
    if (action !== undefined) action = { type: 'clear' }
  }

  const onDestroy: EventHandler<'onDestroy'> = entity => {
    if (entity === selected.value) selected.value = undefined
  }

  return createEntity({
    init({ game }) {
      game.events.common.addListener('onDestroy', onDestroy)

      return { game, debug: game.debug }
    },

    initRenderContext({ game }, { canvas, stage, camera }) {
      type Handle = 'rotation' | `${'bottom' | 'top'}${'Left' | 'Right'}`
      const isHandle = (point: Vector): Handle | undefined => {
        const bounds = selected.value?.rectangleBounds()
        if (!selected.value || !bounds) return undefined
        const entity = selected.value

        const inverse = 1 / camera.scale
        const distanceTest = handleSize * 1.5 * inverse
        const { width, height } = bounds
        const angle = toRadians(entity.transform.rotation)

        // TODO: Ensure corrections for camera scale work

        const topLeft = Vec.rotateAbout(
          {
            x: entity.transform.position.x - width / 2 - strokeWidth / 2,
            y: entity.transform.position.y - height / 2 - strokeWidth / 2,
          },
          angle,
          entity.transform.position,
        )

        const topRight = Vec.rotateAbout(
          {
            x: entity.transform.position.x + width / 2 + strokeWidth / 2,
            y: entity.transform.position.y - height / 2 - strokeWidth / 2,
          },
          angle,
          entity.transform.position,
        )

        const bottomLeft = Vec.rotateAbout(
          {
            x: entity.transform.position.x - width / 2 - strokeWidth / 2,
            y: entity.transform.position.y + height / 2 + strokeWidth / 2,
          },
          angle,
          entity.transform.position,
        )

        const bottomRight = Vec.rotateAbout(
          {
            x: entity.transform.position.x + width / 2 + strokeWidth / 2,
            y: entity.transform.position.y + height / 2 + strokeWidth / 2,
          },
          angle,
          entity.transform.position,
        )

        const scaledStalkHeight = Math.min(
          rotStalkHeight * inverse,
          rotStalkHeight,
        )

        const rotation = Vec.rotateAbout(
          {
            x: entity.transform.position.x,
            y: entity.transform.position.y - height / 2 - scaledStalkHeight,
          },
          angle,
          entity.transform.position,
        )

        const distances: [number, Handle][] = [
          [distance(topLeft, point), 'topLeft'],
          [distance(topRight, point), 'topRight'],
          [distance(bottomLeft, point), 'bottomLeft'],
          [distance(bottomRight, point), 'bottomRight'],
          [distance(rotation, point), 'rotation'],
        ]

        const filtered = distances.filter(
          ([distance]) => distance <= distanceTest,
        )

        if (filtered.length === 0) return undefined
        filtered.sort(([a], [b]) => a - b)

        return filtered[0][1]
      }

      const updateCursor = (point: Vector) => {
        const validHover =
          selected.value &&
          (selected.value.isPointInside(point) ||
            isHandle(point) !== undefined ||
            (action !== undefined && action.type !== 'clear'))

        canvas.style.cursor = validHover ? 'pointer' : ''
      }

      const onClick = (ev: MouseEvent) => {
        if (!editorEnabled.value) return
        const pos = camera.localToWorld({ x: ev.offsetX, y: ev.offsetY })
        const query = game.queryPosition(pos).filter(entity => !entity.preview)

        // Sort based on z-index
        query.sort((a, b) => b.transform.zIndex - a.transform.zIndex)

        const prev = selected.value
        selected.value =
          action?.type === 'clear'
            ? selected.value
            : query.length > 0
            ? query[0]
            : isHandle(pos)
            ? selected.value
            : undefined

        if (selected.value !== prev) {
          if (prev) game.physics.resume(prev)
          if (selected.value) game.physics.suspend(selected.value)
        }

        updateCursor(pos)
        if (action?.type === 'clear') action = undefined

        // @ts-expect-error global assign in dev
        if (import.meta.env.DEV) window.entity = selected
      }

      const onMouseDown = (ev: MouseEvent) => {
        if (!editorEnabled.value) return
        const pos = camera.localToWorld({ x: ev.offsetX, y: ev.offsetY })
        if (!selected.value) return

        const handle = isHandle(pos)
        if (handle === 'rotation') {
          action = { type: 'rotate' }
        } else if (handle) {
          action = {
            type: 'scale',
            origin: pos,
          }
        } else if (selected.value.isPointInside(pos)) {
          action = {
            type: 'translate',
            origin: Vec.sub(selected.value.transform.position, pos),
          }
        }
      }

      const onMouseMove = () => {
        const pos = game.client.inputs.getCursor()
        if (!pos) return
        updateCursor(pos)

        if (!selected.value || !action) return
        const entity = selected.value
        const shift = game.client.inputs.getKey('ShiftLeft')

        switch (action.type) {
          case 'rotate': {
            const radians = angleBetween(entity.transform.position, pos)
            const degrees = toDegrees(radians + Math.PI / 2)

            const angle = shift ? snap(degrees, 15) : degrees
            entity.transform.rotation = angle

            break
          }

          case 'scale': {
            // TODO: Account for mouse offset

            const radians = toRadians(0 - entity.transform.rotation)
            const rotated = Vec.rotateAbout(
              pos,
              radians,
              entity.transform.position,
            )

            const edge = Vec.sub(rotated, entity.transform.position)
            const abs = absolute(edge)
            const width = Math.max(abs.x * 2, 1)
            const height = Math.max(abs.y * 2, 1)

            const size = Math.max(width, height)
            const bounds: Bounds = shift
              ? { width: size, height: size }
              : { width, height }

            game.resize(entity, bounds)

            break
          }

          case 'translate': {
            const offset = Vec.add(pos, action.origin)
            const newPosition = shift ? snapVector(offset, 10) : offset

            entity.transform.position.x = newPosition.x
            entity.transform.position.y = newPosition.y

            break
          }

          case 'clear': {
            // No-op
            break
          }
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

    teardown({ game }) {
      game.events.common.removeListener('onDestroy', onDestroy)
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

      const bounds = selected.value?.rectangleBounds()
      if (!selected.value || !bounds) {
        container.alpha = 0
        return
      }

      const entity = selected.value
      const inverse = 1 / camera.scale
      const scaledWidth = strokeWidth * inverse

      const pos = Vec.add(entity.transform.position, camera.offset)
      container.alpha = 1
      container.position = pos
      container.angle = entity.transform.rotation

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

      const inverseRot = -entity.transform.rotation
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
