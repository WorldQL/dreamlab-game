/* eslint-disable id-length */
import { createEntity, dataManager, isSpawnableEntity } from '@dreamlab.gg/core'
import type { Entity, Game, SpawnableEntity } from '@dreamlab.gg/core'
import type { Camera } from '@dreamlab.gg/core/entities'
import type { EventHandler } from '@dreamlab.gg/core/events'
import { EventEmitter } from '@dreamlab.gg/core/events'
import {
  absolute,
  angleBetween,
  distance,
  snap,
  toDegrees,
  toRadians,
  Vec,
} from '@dreamlab.gg/core/math'
import type { Bounds, Transform, Vector } from '@dreamlab.gg/core/math'
import type { Debug, Ref } from '@dreamlab.gg/core/utils'
import { drawBox, drawCircle, setProperty } from '@dreamlab.gg/core/utils'
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
  onSelect: [id: string | undefined]
  onArgsUpdate: [id: string, args: Record<string, unknown>]
  onArgsManualUpdate: [id: string, key: string, value: unknown]
  onTransformUpdate: [id: string, transform: Transform]
  onTransformManualUpdate: [id: string, transform: Transform]
}

async function getPngDimensions(
  url: string,
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image()

    // eslint-disable-next-line unicorn/prefer-add-event-listener
    img.onload = () => {
      const dimensions = { width: img.width, height: img.height }
      resolve(dimensions)
    }

    // eslint-disable-next-line unicorn/prefer-add-event-listener
    img.onerror = () => {
      reject(new Error('An error occurred loading the image.'))
    }

    img.src = url

    if (img.complete) {
      // @ts-expect-error: I don't need to pass an ev
      img.onload()
    }
  })
}

function getEntityEdges(entity: SpawnableEntity) {
  const { width, height } = entity.args
  const { position, rotation } = entity.transform
  const halfWidth = width / 2
  const halfHeight = height / 2
  const corners = [
    { x: position.x - halfWidth, y: position.y - halfHeight },
    { x: position.x + halfWidth, y: position.y - halfHeight },
    { x: position.x + halfWidth, y: position.y + halfHeight },
    { x: position.x - halfWidth, y: position.y + halfHeight },
  ]

  return corners.map(corner => rotatePoint(corner, rotation, position))
}

function getEntityEdgeMidpoints(entity: SpawnableEntity) {
  const corners = getEntityEdges(entity)
  const midpoints = []
  for (let i = 0; i < corners.length; i++) {
    const nextIndex = (i + 1) % corners.length
    midpoints.push(midpoint(corners[i], corners[nextIndex]))
  }

  return midpoints
}

function queryEntitiesInRange(
  game: Game<false>,
  entity: SpawnableEntity,
  range: number,
) {
  const allEntities = game.entities.filter(isSpawnableEntity)
  const entitiesInRange = []

  const selectedBoundingBox = getBoundingBox(entity)

  for (const otherEntity of allEntities) {
    if (
      otherEntity === entity ||
      otherEntity.definition.tags?.includes('editorIgnoreSnap')
    ) {
      continue
    }

    const otherBoundingBox = getBoundingBox(otherEntity)
    if (boundingBoxesInRange(selectedBoundingBox, otherBoundingBox, range)) {
      entitiesInRange.push(otherEntity)
    }
  }

  return entitiesInRange
}

function getBoundingBox(entity: SpawnableEntity) {
  const edges = getEntityEdges(entity)
  const minX = Math.min(...edges.map(e => e.x))
  const maxX = Math.max(...edges.map(e => e.x))
  const minY = Math.min(...edges.map(e => e.y))
  const maxY = Math.max(...edges.map(e => e.y))

  return { minX, maxX, minY, maxY }
}

function boundingBoxesInRange(
  box1: { minX: number; maxX: number; minY: number; maxY: number },
  box2: { minX: number; maxX: number; minY: number; maxY: number },
  range: number,
): boolean {
  const overlapX = Math.max(
    0,
    Math.min(box1.maxX, box2.maxX) - Math.max(box1.minX, box2.minX),
  )
  const overlapY = Math.max(
    0,
    Math.min(box1.maxY, box2.maxY) - Math.max(box1.minY, box2.minY),
  )
  const overlap = overlapX > 0 && overlapY > 0

  return overlap || distanceBetweenBoxes(box1, box2) <= range
}

function distanceBetweenBoxes(
  box1: { minX: number; maxX: number; minY: number; maxY: number },
  box2: { minX: number; maxX: number; minY: number; maxY: number },
): number {
  const dx =
    box1.minX > box2.maxX
      ? box1.minX - box2.maxX
      : box2.minX > box1.maxX
        ? box2.minX - box1.maxX
        : 0
  const dy =
    box1.minY > box2.maxY
      ? box1.minY - box2.maxY
      : box2.minY > box1.maxY
        ? box2.minY - box1.maxY
        : 0

  return Math.hypot(dx, dy)
}

function calculateTranslationSnap(
  game: Game<false>,
  selected: SpawnableEntity,
  snapThreshold: number,
): Vector | null {
  let closestSnapPoint = null
  let minDistance = Number.MAX_VALUE

  // Get edges and midpoints of the selected entity
  const selectedEdges = getEntityEdges(selected)
  const selectedMidpoints = getEntityEdgeMidpoints(selected)

  // Iterate over nearby entities
  for (const entity of queryEntitiesInRange(game, selected, snapThreshold)) {
    if (entity === selected) continue

    const entityEdges = getEntityEdges(entity)
    const entityMidpoints = getEntityEdgeMidpoints(entity)

    // Compare all combinations of points between the two entities
    for (const point1 of [...selectedEdges, ...selectedMidpoints]) {
      for (const point2 of [...entityEdges, ...entityMidpoints]) {
        const dist = distance(point1, point2)
        if (dist < minDistance) {
          minDistance = dist
          closestSnapPoint = point2 // Choose the point on the nearby entity
        }
      }
    }
  }

  if (closestSnapPoint && minDistance <= snapThreshold) {
    // Calculate the snap offset
    return Vec.sub(closestSnapPoint, selected.transform.position)
  }

  return null // No snapping if no suitable point found
}

function rotatePoint(point: Vector, angle: number, center: Vector) {
  const cosTheta = Math.cos(angle)
  const sinTheta = Math.sin(angle)
  const translatedPoint = { x: point.x - center.x, y: point.y - center.y }
  return {
    x: translatedPoint.x * cosTheta - translatedPoint.y * sinTheta + center.x,
    y: translatedPoint.x * sinTheta + translatedPoint.y * cosTheta + center.y,
  }
}

function midpoint(point1: Vector, point2: Vector) {
  return {
    x: (point1.x + point2.x) / 2,
    y: (point1.y + point2.y) / 2,
  }
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
  let _game: Game<false> | undefined

  const onMouseUp = () => {
    if (action !== undefined) action = { type: 'clear' }
  }

  const onDestroy: EventHandler<'onDestroy'> = entity => {
    if (entity === selected) selected = undefined
  }

  const events = new EventEmitter<EntityEvents>()

  const onDrop = (ev: DragEvent) => {
    ev.preventDefault()

    // due to a weird interaction between CORS and the cache we have to do this. remove the buster param and see what happens.
    const url = ev.dataTransfer?.getData('text/plain') + '?buster=123'
    if (!url) {
      console.log('Returning from drop event because no url')
      return
    }

    if (!selected) {
      setTimeout(async () => {
        // try removing otherbuster and clearing your cache then adding an image. breaks there too.
        // weird browser cache and CORS race condition I think.
        const dimensions = await getPngDimensions(url + '&otherbuster=456')
        console.log(dimensions)

        const cursorPosition = _game?.client.inputs.getCursor('world')
        if (!cursorPosition) {
          console.log('Returning from drop event because no cursorPosition')
          return
        }

        const definition = {
          entity: '@dreamlab/Nonsolid',
          args: {
            width: dimensions.width / 2,
            height: dimensions.height / 2,
            spriteSource: { url },
          },
          transform: {
            position: {
              x: cursorPosition.x,
              y: cursorPosition.y,
            },
          },
          tags: [],
        }
        void _game?.client?.network?.sendEntityCreate(definition)
      }, 20) // when dragging the cursor doesn't exist but it immediately reappears after dropping
      return
    }

    if ('spriteSource' in selected.argsSchema.shape) {
      selected.args.spriteSource = { url }
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
      _game = game
      game.events.common.addListener('onDestroy', onDestroy)

      this.events.addListener('onArgsManualUpdate', (entityId, key, value) => {
        if (!selected || selected.uid !== entityId) return
        setProperty(selected.args, key, value)
      })

      this.events.addListener(
        'onTransformManualUpdate',
        (entityId, newTransform) => {
          if (!selected || selected.uid !== entityId) return

          const { position, zIndex, rotation } = newTransform

          selected.definition.transform = newTransform
          selected.transform.position = position
          selected.transform.zIndex = zIndex
          selected.transform.rotation = rotation
        },
      )

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
            events.emit('onTransformUpdate', selected.uid, selected.transform)
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
            if (shift) {
              const snapOffset = calculateTranslationSnap(game, selected, 15)
              if (snapOffset) {
                selected.transform.position = Vec.add(
                  selected.transform.position,
                  snapOffset,
                )
                events.emit(
                  'onTransformUpdate',
                  selected.uid,
                  selected.transform,
                )

                break
              }
            }

            const offset = Vec.add(pos, action.origin)

            selected.transform.position.x = offset.x
            selected.transform.position.y = offset.y

            events.emit('onTransformUpdate', selected.uid, selected.transform)

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
