/* eslint-disable id-length */
import { createEntity, dataManager } from '@dreamlab.gg/core'
import type { Entity, Game, SpawnableEntity } from '@dreamlab.gg/core'
import type { Camera } from '@dreamlab.gg/core/entities'
import type { EventHandler } from '@dreamlab.gg/core/events'
import { EventEmitter } from '@dreamlab.gg/core/events'
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
import type { Debug, Ref } from '@dreamlab.gg/core/utils'
import { drawBox, drawCircle } from '@dreamlab.gg/core/utils'
import { Container, Graphics } from 'pixi.js'
import type { ToServerPacket } from '../../packets'

type CornerHandle = `${'bottom' | 'top'}${'Left' | 'Right'}`
type Handle = CornerHandle | 'rotation'

const getOppositeCorner = (handle: CornerHandle): CornerHandle => {
  const oppositeHandle: CornerHandle | undefined =
    handle === 'topLeft'
      ? 'bottomRight'
      : handle === 'topRight'
        ? 'bottomLeft'
        : handle === 'bottomLeft'
          ? 'topRight'
          : handle === 'bottomRight'
            ? 'topLeft'
            : undefined

  if (!oppositeHandle) throw new Error('invalid handle')
  return oppositeHandle
}

type ActionData =
  | { type: 'clear' }
  | { type: 'rotate' }
  | { type: 'scale'; origin: Vector; locked: CornerHandle; opposite: Vector }
  | { type: 'translate'; origin: Vector }

interface Data {
  game: Game<boolean>
  debug: Debug
}

const onDragOver = (ev: DragEvent) => {
  ev.preventDefault()
}

interface Render {
  canvas: HTMLCanvasElement
  camera: Camera
  container: Container
  boundsGfx: Graphics
  topLeftGfx: Graphics
  topRightGfx: Graphics
  bottomLeftGfx: Graphics
  bottomRightGfx: Graphics
  rotStalkGfx: Graphics
  rotHandleGfx: Graphics
  onMouseDown(ev: MouseEvent): void
  onMouseMove(): void
}

export interface Selector extends Entity<Data, Render> {
  get events(): EventEmitter<EntityEvents>
  get selected(): SpawnableEntity | undefined

  select(entity: SpawnableEntity | undefined): void
  deselect(): void
}

interface EntityEvents {
  onSelect: [string | undefined]
  onArgsUpdate: [string, unknown]
  onArgsManualUpdate: [string, unknown]
  onPositionUpdate: [string, Vector]
}

export const createEntitySelect = (
  editorEnabled: Ref<boolean>,
  sendPacket?: (packet: ToServerPacket) => void,
) => {
  const colour = '#22a2ff'
  const strokeWidth = 2
  const handleSize = 10
  const rotStalkHeight = 30

  let selected: SpawnableEntity | undefined
  let action: ActionData | undefined

  const onMouseUp = () => {
    if (action !== undefined) action = { type: 'clear' }
  }

  const onDestroy: EventHandler<'onDestroy'> = entity => {
    if (entity === selected) selected = undefined
  }

  const events = new EventEmitter<EntityEvents>()

  const onDrop = (ev: DragEvent) => {
    ev.preventDefault()
    if (!selected) return

    const url = ev.dataTransfer?.getData('text/plain')
    if (!url) return

    if ('spriteSource' in selected.argsSchema.shape) {
      selected.args.spriteSource = url
    } else if (selected.definition.entity === '@dreamlab/BackgroundTrigger') {
      selected.args.onEnter = { action: 'set', textureURL: url }
    }

    events.emit('onArgsUpdate', selected.uid, selected.args)
  }

  return createEntity<Selector, Data, Render>({
    get selected() {
      return selected
    },

    get events() {
      return events
    },

    select(entity) {
      const { game } = dataManager.getData(this)

      events.emit('onSelect', entity?.uid)

      const prev = selected
      selected = entity

      if (selected !== prev) {
        if (prev) {
          game.physics.resume('@editor', [prev])
          sendPacket?.({
            t: 'PhysicsSuspendResume',
            action: 'resume',
            entity_id: prev.uid,
          })
        }

        if (selected) {
          game.physics.suspend('@editor', [selected])
          sendPacket?.({
            t: 'PhysicsSuspendResume',
            action: 'suspend',
            entity_id: selected.uid,
          })
        }
      }
    },

    deselect() {
      this.select(undefined)
    },

    init({ game }) {
      game.events.common.addListener('onDestroy', onDestroy)

      this.events.addListener('onArgsManualUpdate', (entityId, args) => {
        if (selected && selected.uid === entityId) {
          const newArgs = args as Record<string, unknown>
          const width = Number.parseFloat(newArgs.width as string)
          const height = Number.parseFloat(newArgs.height as string)

          if (
            (width !== selected.args.width ||
              height !== selected.args.height) &&
            !Number.isNaN(width) &&
            !Number.isNaN(height)
          ) {
            game.resize(selected, { width, height })
            newArgs.width = width
            newArgs.height = height
          }

          selected.definition.args = newArgs
        }
      })

      return { game, debug: game.debug }
    },

    initRenderContext({ game }, { canvas, stage, camera }) {
      const getHandlePosition = (
        selected: SpawnableEntity,
        bounds: Bounds,
        handle: Handle,
      ): Vector => {
        const inverse = 1 / camera.scale
        const { width, height } = bounds
        const angle = toRadians(selected.transform.rotation)

        switch (handle) {
          case 'topLeft': {
            return Vec.rotateAbout(
              {
                x: selected.transform.position.x - width / 2 - strokeWidth / 2,
                y: selected.transform.position.y - height / 2 - strokeWidth / 2,
              },
              angle,
              selected.transform.position,
            )
          }

          case 'topRight': {
            return Vec.rotateAbout(
              {
                x: selected.transform.position.x + width / 2 + strokeWidth / 2,
                y: selected.transform.position.y - height / 2 - strokeWidth / 2,
              },
              angle,
              selected.transform.position,
            )
          }

          case 'bottomLeft': {
            return Vec.rotateAbout(
              {
                x: selected.transform.position.x - width / 2 - strokeWidth / 2,
                y: selected.transform.position.y + height / 2 + strokeWidth / 2,
              },
              angle,
              selected.transform.position,
            )
          }

          case 'bottomRight': {
            return Vec.rotateAbout(
              {
                x: selected.transform.position.x + width / 2 + strokeWidth / 2,
                y: selected.transform.position.y + height / 2 + strokeWidth / 2,
              },
              angle,
              selected.transform.position,
            )
          }

          case 'rotation': {
            const scaledStalkHeight = Math.min(
              rotStalkHeight * inverse,
              rotStalkHeight,
            )

            return Vec.rotateAbout(
              {
                x: selected.transform.position.x,
                y:
                  selected.transform.position.y -
                  height / 2 -
                  scaledStalkHeight,
              },
              angle,
              selected.transform.position,
            )
          }
        }
      }

      const isHandle = (point: Vector): Handle | undefined => {
        const bounds = selected?.rectangleBounds()
        if (!selected || !bounds) return undefined

        const inverse = 1 / camera.scale
        const distanceTest = handleSize * 1.5 * inverse

        const topLeft = getHandlePosition(selected, bounds, 'topLeft')
        const topRight = getHandlePosition(selected, bounds, 'topRight')
        const bottomLeft = getHandlePosition(selected, bounds, 'bottomLeft')
        const bottomRight = getHandlePosition(selected, bounds, 'bottomRight')
        const rotation = getHandlePosition(selected, bounds, 'rotation')

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
          selected &&
          (selected.isPointInside(point) ||
            isHandle(point) !== undefined ||
            (action !== undefined && action.type !== 'clear'))

        canvas.style.cursor = validHover ? 'pointer' : ''
      }

      const onMouseDown = (ev: MouseEvent) => {
        if (!editorEnabled.value) return
        const pos = camera.screenToWorld({ x: ev.offsetX, y: ev.offsetY })

        const query = game
          .queryPosition(pos)
          .filter(
            entity =>
              !entity.preview &&
              !entity.definition.tags?.includes('editorLocked'),
          )

        query.sort((a, b) => b.transform.zIndex - a.transform.zIndex)

        let newSelection: SpawnableEntity | undefined
        if (action?.type === 'clear' && query[0] === selected) {
          newSelection = selected
        } else if (query.length > 0) {
          newSelection = query[0]
        } else if (isHandle(pos)) {
          newSelection = selected
        } else {
          newSelection = undefined
        }

        this.select(newSelection)
        updateCursor(pos)

        if (action?.type === 'clear') action = undefined

        const bounds = selected?.rectangleBounds()
        if (selected && bounds) {
          const handle = isHandle(pos)
          if (handle === 'rotation') {
            action = { type: 'rotate' }
          } else if (handle) {
            const locked = getOppositeCorner(handle)
            const opposite = getHandlePosition(selected, bounds, locked)

            action = {
              type: 'scale',
              origin: pos,
              locked,
              opposite,
            }
          } else if (selected.isPointInside(pos)) {
            action = {
              type: 'translate',
              origin: Vec.sub(selected.transform.position, pos),
            }
          }
        }

        // @ts-expect-error global assign in dev
        if (import.meta.env.DEV) window.entity = selected
      }

      const onMouseMove = () => {
        const pos = game.client.inputs.getCursor()
        if (!pos) return
        updateCursor(pos)

        if (!selected || !action) return
        const shift = game.client.inputs.getKey('ShiftLeft')
        const ctrl = game.client.inputs.getKey('ControlLeft')

        switch (action.type) {
          case 'rotate': {
            const radians = angleBetween(selected.transform.position, pos)
            const degrees = toDegrees(radians + Math.PI / 2)

            const angle = shift ? snap(degrees, 15) : degrees
            selected.transform.rotation = angle

            break
          }

          case 'scale': {
            // TODO: Account for mouse offset

            const radians = toRadians(selected.transform.rotation)
            const inverseRadians = toRadians(0 - selected.transform.rotation)

            if (ctrl) {
              const rotated = Vec.rotateAbout(
                pos,
                inverseRadians,
                selected.transform.position,
              )

              const edge = Vec.sub(rotated, selected.transform.position)
              const abs = absolute(edge)
              const width = Math.max(abs.x * 2, 1)
              const height = Math.max(abs.y * 2, 1)

              const size = Math.max(width, height)
              const bounds: Bounds = shift
                ? { width: size, height: size }
                : { width, height }

              game.resize(selected, bounds)
            } else {
              const rotated = Vec.rotateAbout(
                pos,
                inverseRadians,
                action.opposite,
              )

              const edge = Vec.sub(rotated, action.opposite)
              const abs = absolute(edge)
              const width = Math.max(abs.x, 1)
              const height = Math.max(abs.y, 1)

              const newOrigin = Vec.rotateAbout(
                Vec.add(action.opposite, Vec.div(edge, 2)),
                radians,
                action.opposite,
              )

              selected.transform.position = newOrigin
              game.resize(selected, { width, height })
              events.emit('onArgsUpdate', selected.uid, selected.args)
            }

            break
          }

          case 'translate': {
            const offset = Vec.add(pos, action.origin)
            const newPosition = shift ? snapVector(offset, 10) : offset

            selected.transform.position.x = newPosition.x
            selected.transform.position.y = newPosition.y

            events.emit(
              'onPositionUpdate',
              selected.uid,
              selected.transform.position,
            )

            break
          }

          case 'clear': {
            // No-op
            break
          }
        }
      }

      canvas.addEventListener('dragover', onDragOver)
      canvas.addEventListener('drop', onDrop)
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
        onMouseDown,
        onMouseMove,
      }
    },

    teardown({ game }) {
      game.events.common.removeListener('onDestroy', onDestroy)
    },

    teardownRenderContext({ canvas, container, onMouseDown, onMouseMove }) {
      canvas.removeEventListener('drop', onDrop)
      canvas.removeEventListener('dragover', onDragOver)
      canvas.removeEventListener('mousedown', onMouseDown)
      canvas.removeEventListener('mouseup', onMouseUp)
      canvas.removeEventListener('mousemove', onMouseMove)

      container.destroy({ children: true })
    },

    onRenderFrame(
      _,
      { game },
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
        game.client?.inputs?.enable('mouse', 'editor')
        container.alpha = 0
        return
      }

      game.client?.inputs?.disable('mouse', 'editor')
      const entity = selected
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
