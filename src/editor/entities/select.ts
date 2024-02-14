// import { createEntity, dataManager } from '@dreamlab.gg/core'
import type { Game, LooseSpawnableDefinition, RenderTime, SpawnableEntity } from '@dreamlab.gg/core'
import { Entity } from '@dreamlab.gg/core'
import type { Camera } from '@dreamlab.gg/core/entities'
import type { EventHandler } from '@dreamlab.gg/core/events'
import { EventEmitter } from '@dreamlab.gg/core/events'
import { game } from '@dreamlab.gg/core/labs'
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
import type { Bounds, Transform, Vector } from '@dreamlab.gg/core/math'
import type { Debug, Ref } from '@dreamlab.gg/core/utils'
import { drawBox, drawCircle, setProperty } from '@dreamlab.gg/core/utils'
import cuid2 from '@paralleldrive/cuid2'
import { Container, Graphics } from 'pixi.js'
import type { ToServerPacket } from '../../packets'
import type { HistoryData } from '../components/history'
import { LOCKED_TAG } from '../editor'

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
  | {
      type: 'scale'
      origin: Vector
      locked: CornerHandle
      opposite: Vector
      aspect: number
    }
  | { type: 'clear' }
  | { type: 'rotate' }
  | { type: 'translate'; origin: Vector }

const getPngDimensions = async (url: string): Promise<{ width: number; height: number }> => {
  return new Promise((resolve, reject) => {
    const img = new Image()

    img.addEventListener('load', () => {
      const dimensions = { width: img.width, height: img.height }
      resolve(dimensions)
    })

    img.addEventListener('error', () => {
      reject(new Error('An error occurred loading the image.'))
    })

    img.src = url

    if (img.complete) {
      img.dispatchEvent(new Event('load'))
    }
  })
}

const onDragOver = (ev: DragEvent) => {
  ev.preventDefault()
}

export class Selector extends Entity {
  public constructor(
    public editorEnabled: Ref<boolean>,
    public history: HistoryData,
    public sendPacket?: (packet: ToServerPacket) => void,
  ) {
    super()
    this._game = game('client')

    const canvas = this._game!.client.render.canvas

    this._game!.client.inputs.addListener('Space', this.onSpace)
    canvas.addEventListener('dragover', onDragOver)
    canvas.addEventListener('drop', this.onDrop)
    canvas.addEventListener('mousedown', this.onMouseDown)
    canvas.addEventListener('mouseup', this.onMouseUp)
    canvas.addEventListener('mousemove', this.onMouseMove)

    const container = new Container()
    container.sortableChildren = true
    container.zIndex = 999_999_999 // always render on top

    this._game!.client.render.stage.addChild(container)
    container.addChild(this.boundsGfx)
    container.addChild(this.topLeftGfx)
    container.addChild(this.topRightGfx)
    container.addChild(this.bottomLeftGfx)
    container.addChild(this.bottomRightGfx)
    container.addChild(this.rotStalkGfx)
    container.addChild(this.rotHandleGfx)
    this.container = container
  }

  private boundsGfx = new Graphics()
  private topLeftGfx = new Graphics()
  private topRightGfx = new Graphics()
  private bottomLeftGfx = new Graphics()
  private bottomRightGfx = new Graphics()
  private rotStalkGfx = new Graphics()
  private rotHandleGfx = new Graphics()

  public readonly colour = '#22a2ff'
  public strokeWidth = 2
  public handleSize = 10
  public rotStalkHeight = 30
  public isSpacePressed = false
  public lastClickTime = 0
  public container: Container

  public selected: SpawnableEntity | undefined
  public events = new EventEmitter<EntityEvents>()
  public action: ActionData | undefined
  public _game: Game<false> | undefined

  public prevEntityData: SpawnableEntity | undefined
  public actionOccurred = false

  public onMouseUp = () => {
    if (this.prevEntityData && this.action && this.actionOccurred) {
      if (this.action.type !== 'scale' && this.action.type !== 'clear') {
        this.history.record({
          type: 'transform',
          definition: this.prevEntityData,
        })
      } else {
        this.history.record({
          type: 'args',
          definition: this.prevEntityData,
        })
      }

      this.prevEntityData = undefined
    }

    if (this.action !== undefined) {
      this.action = { type: 'clear' }
    }
  }

  public onSpace = (pressed: boolean) => {
    this.isSpacePressed = pressed
  }

  public teardown(): void {
    const _game = game('client')
    if (!_game) return
    const canvas = _game.client.render.canvas

    canvas.removeEventListener('drop', this.onDrop)
    canvas.removeEventListener('dragover', onDragOver)
    canvas.removeEventListener('mousedown', this.onMouseDown)
    canvas.removeEventListener('mouseup', this.onMouseUp)
    canvas.removeEventListener('mousemove', this.onMouseMove)

    this.container.destroy({ children: true })
    _game.events.common.removeListener('onDestroy', this.onDestroy)
    _game.client?.inputs.removeListener('Space', this.onSpace)
  }

  public duplicateEntity = async (entity: SpawnableEntity) => {
    const uid = cuid2.createId()
    const position = entity.definition.transform.position

    const definition = {
      ...entity.definition,
      uid,
      transform: {
        ...entity.definition.transform,
        position,
      },
    }

    await (this._game?.client.network
      ? this._game?.client?.network?.sendEntityCreate(definition)
      : this._game?.spawn(definition))
    this.history.record({ type: 'create', uid: definition.uid })
  }

  public select(entity: SpawnableEntity | undefined) {
    const _game = game('client')
    if (!_game) {
      return
    }

    const prev = this.selected
    this.selected = entity
    this.events.emit('onSelect', entity?.uid)

    try {
      // @ts-expect-error Internal Value
      if (prev) prev._selected.value = false
    } catch {
      console.warn('Failed to remove previous selected state')
    }

    try {
      // @ts-expect-error Internal Value
      if (selected) selected._selected.value = true
    } catch {
      console.warn('Failed to set selected state')
    }

    if (this.selected !== prev) {
      if (prev) {
        _game.physics.resume('@editor', [prev])
        this.sendPacket?.({
          t: 'PhysicsSuspendResume',
          action: 'resume',
          entity_id: prev.uid,
        })
      }

      if (this.selected) {
        _game.physics.suspend('@editor', [this.selected])
        this.sendPacket?.({
          t: 'PhysicsSuspendResume',
          action: 'suspend',
          entity_id: this.selected.uid,
        })
      }
    }
  }
  public deselect() {
    this.select(undefined)
  }
  public onDestroy: EventHandler<'onDestroy'> = entity => {
    if (entity === this.selected) this.selected = undefined
  }
  public onDrop = (ev: DragEvent) => {
    ev.preventDefault()

    const url = ev.dataTransfer?.getData('text/plain')
    if (!url) {
      console.log('Returning from drop event because no url')
      return
    }

    if (!this.selected) {
      setTimeout(async () => {
        const dimensions = await getPngDimensions(url)

        const cursorPosition = this._game?.client.inputs.getCursor('world')
        if (!cursorPosition) {
          console.log('Returning from drop event because no cursorPosition')
          return
        }

        const uid = cuid2.createId()
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
          uid,
        } satisfies LooseSpawnableDefinition

        this.history.record({ type: 'create', uid: definition.uid })

        await (this._game?.client.network
          ? this._game?.client?.network?.sendEntityCreate(definition)
          : this._game?.spawn(definition))
      }, 20) // when dragging the cursor doesn't exist but it immediately reappears after dropping
      return
    }

    const prevEntity = JSON.parse(JSON.stringify(this.selected))
    if ('spriteSource' in this.selected.argsSchema.shape) {
      this.selected.args.spriteSource = { url }
    } else if (this.selected.definition.entity === '@dreamlab/BackgroundTrigger') {
      this.selected.args.onEnter = { action: 'set', textureURL: url }
    }

    this.history.record({
      type: 'args',
      definition: prevEntity,
    })
    this.events.emit('onArgsUpdate', this.selected.uid, this.selected.args)
  }

  public getHandlePosition = (
    selected: SpawnableEntity,
    bounds: Bounds,
    handle: Handle,
  ): Vector => {
    const _game = game('client')
    if (!_game) {
      return Vec.create(0, 0)
    }

    const inverse = 1 / _game.client.render.camera.scale
    const { width, height } = bounds
    const angle = toRadians(selected.transform.rotation)

    switch (handle) {
      case 'topLeft': {
        return Vec.rotateAbout(
          {
            x: selected.transform.position.x - width / 2 - this.strokeWidth / 2,
            y: selected.transform.position.y - height / 2 - this.strokeWidth / 2,
          },
          angle,
          selected.transform.position,
        )
      }

      case 'topRight': {
        return Vec.rotateAbout(
          {
            x: selected.transform.position.x + width / 2 + this.strokeWidth / 2,
            y: selected.transform.position.y - height / 2 - this.strokeWidth / 2,
          },
          angle,
          selected.transform.position,
        )
      }

      case 'bottomLeft': {
        return Vec.rotateAbout(
          {
            x: selected.transform.position.x - width / 2 - this.strokeWidth / 2,
            y: selected.transform.position.y + height / 2 + this.strokeWidth / 2,
          },
          angle,
          selected.transform.position,
        )
      }

      case 'bottomRight': {
        return Vec.rotateAbout(
          {
            x: selected.transform.position.x + width / 2 + this.strokeWidth / 2,
            y: selected.transform.position.y + height / 2 + this.strokeWidth / 2,
          },
          angle,
          selected.transform.position,
        )
      }

      case 'rotation': {
        const scaledStalkHeight = Math.min(this.rotStalkHeight * inverse, this.rotStalkHeight)

        return Vec.rotateAbout(
          {
            x: selected.transform.position.x,
            y: selected.transform.position.y - height / 2 - scaledStalkHeight,
          },
          angle,
          selected.transform.position,
        )
      }
    }
  }

  public isHandle = (point: Vector): Handle | undefined => {
    const bounds = this.selected?.bounds()
    if (!this.selected || !bounds) return undefined

    const inverse = 1 / this._game!.client.render.camera.scale
    const distanceTest = this.handleSize * 1.15 * inverse

    const topLeft = this.getHandlePosition(this.selected, bounds, 'topLeft')
    const topRight = this.getHandlePosition(this.selected, bounds, 'topRight')
    const bottomLeft = this.getHandlePosition(this.selected, bounds, 'bottomLeft')
    const bottomRight = this.getHandlePosition(this.selected, bounds, 'bottomRight')
    const rotation = this.getHandlePosition(this.selected, bounds, 'rotation')

    const distances: [number, Handle][] = [
      [distance(topLeft, point), 'topLeft'],
      [distance(topRight, point), 'topRight'],
      [distance(bottomLeft, point), 'bottomLeft'],
      [distance(bottomRight, point), 'bottomRight'],
      [distance(rotation, point), 'rotation'],
    ]

    const filtered = distances.filter(([distance]) => distance <= distanceTest)

    if (filtered.length === 0) return undefined
    filtered.sort(([a], [b]) => a - b)

    return filtered[0][1]
  }

  public updateCursor = (point: Vector) => {
    const validHover =
      this.selected &&
      (this.selected.isPointInside(point) ||
        this.isHandle(point) !== undefined ||
        (this.action !== undefined && this.action.type !== 'clear'))

    this._game!.client.render.canvas.style.cursor = validHover ? 'pointer' : ''
  }

  public onMouseDown = (ev: MouseEvent) => {
    if (!this.editorEnabled.value || ev.button === 2) return
    if (ev.button === 1 || (ev.button === 0 && this.isSpacePressed)) {
      this.deselect()
      return
    }

    if (!this._game) {
      return
    }

    const pos = this._game.client.render.camera.screenToWorld({ x: ev.offsetX, y: ev.offsetY })

    const query = this._game
      .queryPosition(pos)
      .filter(entity => !entity.preview && !entity.definition.tags?.includes(LOCKED_TAG))

    query.sort((a, b) => b.transform.zIndex - a.transform.zIndex)
    const currentTime = Date.now()

    let currentQueryIndex = this.selected ? query.indexOf(this.selected) : 0
    let queryEntity = query[currentQueryIndex]

    const timeDiff = currentTime - this.lastClickTime
    const shouldUpdateIndex = timeDiff < 500 && query.length > 1

    if (shouldUpdateIndex) {
      currentQueryIndex = (currentQueryIndex + 1) % query.length
      queryEntity = query[currentQueryIndex]
    }

    let newSelection: SpawnableEntity | undefined
    if (this.action?.type === 'clear' && queryEntity === this.selected) {
      newSelection = this.selected
    } else if (this.isHandle(pos)) {
      newSelection = this.selected
    } else if (query.length > 0) {
      newSelection = queryEntity
    } else {
      newSelection = undefined
    }

    this.lastClickTime = currentTime

    if (newSelection) {
      this.prevEntityData = JSON.parse(JSON.stringify(newSelection))
      if (ev.altKey && ev.button === 0) {
        void this.duplicateEntity(newSelection)
      }
    }

    this.select(newSelection)
    this.updateCursor(pos)
    this.actionOccurred = false

    if (this.action?.type === 'clear') this.action = undefined

    const bounds = this.selected?.bounds()
    if (this.selected && bounds) {
      const handle = this.isHandle(pos)
      if (handle === 'rotation') {
        this.action = { type: 'rotate' }
      } else if (handle) {
        const locked = getOppositeCorner(handle)
        const opposite = this.getHandlePosition(this.selected, bounds, locked)

        this.action = {
          type: 'scale',
          origin: pos,
          locked,
          opposite,
          aspect: bounds.width / bounds.height,
        }
      } else if (this.selected.isPointInside(pos)) {
        this.action = {
          type: 'translate',
          origin: Vec.sub(this.selected.transform.position, pos),
        }
      }
    }

    // @ts-expect-error global assign in dev
    if (import.meta.env.DEV) window.entity = selected
  }

  public onMouseMove = () => {
    const _game = game('client')
    if (!_game) {
      return
    }

    const pos = _game.client.inputs.getCursor()
    if (!pos) return
    this.updateCursor(pos)

    if (!this.selected || !this.action) return
    const shift = _game.client.inputs.getKey('ShiftLeft')
    const ctrl = _game.client.inputs.getKey('ControlLeft')
    this.actionOccurred = true

    switch (this.action.type) {
      case 'rotate': {
        const radians = angleBetween(this.selected.transform.position, pos)
        const degrees = toDegrees(radians + Math.PI / 2)

        const angle = shift ? snap(degrees, 15) : degrees
        const newTransform = {
          position: this.selected.transform.position,
          rotation: angle,
          zIndex: this.selected.transform.zIndex,
        }
        this.events.emit('onTransformUpdate', this.selected.uid, newTransform)
        break
      }

      case 'scale': {
        // TODO: Account for mouse offset
        const radians = toRadians(this.selected.transform.rotation)
        const inverseRadians = toRadians(0 - this.selected.transform.rotation)

        if (ctrl) {
          const rotated = Vec.rotateAbout(pos, inverseRadians, this.selected.transform.position)

          const edge = Vec.sub(rotated, this.selected.transform.position)
          const abs = absolute(edge)
          const width = Math.max(abs.x * 2, 1)
          const height = Math.max(abs.y * 2, 1)

          const size = Math.max(width, height)
          const bounds: Bounds = shift
            ? { width: size, height: size / this.action.aspect }
            : { width, height }

          _game.resize(this.selected, bounds)
          this.events.emit('onArgsUpdate', this.selected.uid, this.selected.args)
        } else {
          const rotated = Vec.rotateAbout(pos, inverseRadians, this.action.opposite)

          const edge = Vec.sub(rotated, this.action.opposite)
          const abs = absolute(edge)
          const width = Number.parseFloat(Math.max(abs.x, 1).toFixed(2))
          const height = Number.parseFloat(
            (shift ? width / this.action.aspect : Math.max(abs.y, 1)).toFixed(2),
          )
          edge.y *= height / abs.y

          const newOrigin = Vec.rotateAbout(
            Vec.add(this.action.opposite, Vec.div(edge, 2)),
            radians,
            this.action.opposite,
          )

          const newTransform = {
            ...this.selected.transform,
            position: newOrigin,
          }
          this.selected.transform.position = newOrigin
          _game.resize(this.selected, { width, height })
          this.events.emit('onTransformUpdate', this.selected.uid, newTransform)
          this.events.emit('onArgsUpdate', this.selected.uid, this.selected.args)
        }

        break
      }

      case 'translate': {
        const offset = Vec.add(pos, this.action.origin)
        const newPosition = shift ? snapVector(offset, 10) : offset

        const newTransform = {
          ...this.selected.transform,
          position: newPosition,
        }

        this.events.emit('onTransformUpdate', this.selected.uid, newTransform)
        break
      }

      case 'clear': {
        // No-op
        this.actionOccurred = false
        break
      }
    }
  }
  public onRenderFrame(time: RenderTime): void {
    const bounds = this.selected?.bounds()
    const _game = game('client')
    if (!_game) return

    if (!this.selected || !bounds) {
      _game.client?.inputs?.enable('mouse', 'editor')
      this.container.alpha = 0
      return
    }

    _game.client?.inputs?.disable('mouse', 'editor')
    const entity = this.selected
    const inverse = 1 / _game.client.render.camera.scale
    const scaledWidth = this.strokeWidth * inverse

    const pos = Vec.add(entity.transform.position, _game.client.render.camera.offset)
    this.container.alpha = 1
    this.container.position = pos
    this.container.angle = entity.transform.rotation

    const width = bounds.width + scaledWidth * 2
    const height = bounds.height + scaledWidth * 2
    drawBox(this.boundsGfx, { width, height }, { stroke: this.colour, strokeWidth: scaledWidth })

    const handlesRender = {
      stroke: this.colour,
      strokeWidth: scaledWidth,
      fill: 'white',
      fillAlpha: 1,
    }

    // #region Scale Handles
    const handlesSize = {
      width: this.handleSize * inverse,
      height: this.handleSize * inverse,
    }

    drawBox(this.topLeftGfx, handlesSize, handlesRender)
    drawBox(this.topRightGfx, handlesSize, handlesRender)
    drawBox(this.bottomLeftGfx, handlesSize, handlesRender)
    drawBox(this.bottomRightGfx, handlesSize, handlesRender)

    this.topLeftGfx.position = {
      x: bounds.width / 2 + scaledWidth / 2,
      y: -(bounds.height / 2 + scaledWidth / 2),
    }

    this.topRightGfx.position = {
      x: -(bounds.width / 2 + scaledWidth / 2),
      y: -(bounds.height / 2 + scaledWidth / 2),
    }

    this.bottomLeftGfx.position = {
      x: bounds.width / 2 + scaledWidth / 2,
      y: bounds.height / 2 + scaledWidth / 2,
    }

    this.bottomRightGfx.position = {
      x: -(bounds.width / 2 + scaledWidth / 2),
      y: bounds.height / 2 + scaledWidth / 2,
    }

    const inverseRot = -entity.transform.rotation
    this.topLeftGfx.angle = inverseRot
    this.topRightGfx.angle = inverseRot
    this.bottomLeftGfx.angle = inverseRot
    this.bottomRightGfx.angle = inverseRot
    // #endregion

    // #region Rotation Handle
    const scaledStalkHeight = Math.min(this.rotStalkHeight * inverse, this.rotStalkHeight)

    drawBox(
      this.rotStalkGfx,
      {
        width: scaledWidth,
        height: scaledStalkHeight,
      },
      { fill: this.colour, fillAlpha: 1, strokeAlpha: 0 },
    )

    drawCircle(this.rotHandleGfx, { radius: (this.handleSize / 1.75) * inverse }, handlesRender)

    this.rotStalkGfx.position.y = -height / 2 - scaledStalkHeight / 2
    this.rotHandleGfx.position.y = -height / 2 - scaledStalkHeight
    // #endregion
  }
}

interface EntityEvents {
  onSelect: [id: string | undefined]
  onArgsUpdate: [id: string, args: Record<string, unknown>]
  onTransformUpdate: [id: string, transform: Transform]
  onTagsUpdate: [id: string, tags: string[]]
}
