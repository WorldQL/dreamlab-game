import type { SpawnableDefinition, SpawnableEntity } from '@dreamlab.gg/core'
import { Entity, SpawnableDefinitionSchema } from '@dreamlab.gg/core'
import { EventEmitter } from '@dreamlab.gg/core/events'
import { game, inputs } from '@dreamlab.gg/core/labs'
import { cloneTransform } from '@dreamlab.gg/core/math'
import type { Transform } from '@dreamlab.gg/core/math'
import type { Ref } from '@dreamlab.gg/core/utils'
import { clone, getProperty, onChange, setProperty } from '@dreamlab.gg/core/utils'
import copy from 'copy-to-clipboard'

type UpdateAction =
  | { action: 'arg-update'; path: string; value: unknown }
  | { action: 'tag-add'; tag: string }
  | { action: 'tag-remove'; tag: string }
  | { action: 'transform-update'; transform: Transform }

type HistoryEntry =
  | {
      type: 'update'
      uid: string
      actions: readonly [action: UpdateAction, ...actions: UpdateAction[]]
    }
  | { type: 'create'; uid: string; definition: SpawnableDefinition }
  | { type: 'delete'; uid: string; definition: SpawnableDefinition }

interface HistoryEvents {
  readonly onUndo: []
  readonly onRedo: []
}

export class History extends Entity {
  public readonly events = new EventEmitter<HistoryEvents>()

  readonly #selected: Ref<SpawnableEntity | undefined>
  #undoEntries: HistoryEntry[] = []
  #redoEntries: HistoryEntry[] = []

  public constructor({ selected }: { readonly selected: Ref<SpawnableEntity | undefined> }) {
    super()

    this.#selected = selected
    window.addEventListener('keydown', this.#keyDown)
    window.addEventListener('paste', this.#paste)
  }

  public teardown(): void {
    window.removeEventListener('keydown', this.#keyDown)
    window.removeEventListener('paste', this.#paste)
  }

  readonly #keyDown = (ev: KeyboardEvent) => {
    if (!ev.ctrlKey) return
    if (ev.key === 'c') this.copy()
    if (ev.key === 'z') this.undo()
    if (ev.key === 'y') this.redo()
  }

  readonly #paste = (ev: ClipboardEvent) => {
    const data = ev.clipboardData?.getData('text/plain')
    if (!data) return

    try {
      const definition = SpawnableDefinitionSchema.parse(JSON.parse(data))
      const cursor = inputs()!.getCursor()
      if (cursor) definition.transform.position = cursor

      // TODO: Dont broadcast to self and we can spawn on client safely
      window.sendPacket?.({
        t: 'SpawnEntity',
        definition,
      })

      // const entity = game().spawn(definition)
      // if (entity) {
      //   this.recordCreated(entity)

      // }

      ev.preventDefault()
    } catch {
      // No-op
    }
  }

  readonly #cloneDefinition = (definition: SpawnableDefinition): SpawnableDefinition => ({
    entity: definition.entity,
    args: clone(onChange.target(definition.args)),
    transform: cloneTransform(definition.transform),
    uid: definition.uid,
    label: definition.label,
    tags: clone(definition.tags),
  })

  public record(action: HistoryEntry): void {
    this.#redoEntries = []
    this.#undoEntries.push(action)
  }

  public recordCreated(entity: SpawnableEntity): void {
    const definition = this.#cloneDefinition(entity.definition)
    this.record({ type: 'create', uid: entity.uid, definition })
  }

  public recordDeleted(entity: SpawnableEntity): void {
    const definition = this.#cloneDefinition(entity.definition)
    this.record({ type: 'delete', uid: entity.uid, definition })
  }

  public recordTransformChanged(uid: string, transform: Transform): void
  public recordTransformChanged(entity: SpawnableEntity): void
  public recordTransformChanged(arg: SpawnableEntity | string, transform?: Transform): void {
    if (typeof arg === 'string') {
      const uid = arg
      if (typeof transform === 'undefined') throw new Error('must specify transform')

      this.record({
        type: 'update',
        uid,
        actions: [{ action: 'transform-update', transform: cloneTransform(transform) }],
      })
    } else {
      const entity = arg
      const definition = this.#cloneDefinition(entity.definition)
      this.record({
        type: 'update',
        uid: entity.uid,
        actions: [{ action: 'transform-update', transform: definition.transform }],
      })
    }
  }

  private applyUpdate(entity: SpawnableEntity, action: UpdateAction): UpdateAction {
    // TODO: Network
    switch (action.action) {
      case 'transform-update': {
        const previous = cloneTransform(entity.transform)
        entity.transform.position.x = action.transform.position.x
        entity.transform.position.y = action.transform.position.y
        entity.transform.rotation = action.transform.rotation
        entity.transform.zIndex = action.transform.zIndex

        return { action: 'transform-update', transform: previous }
      }

      case 'arg-update': {
        const current: unknown = clone(getProperty(entity.args, action.path))
        setProperty(entity.args, action.path, action.value)

        return { action: 'arg-update', path: action.path, value: current }
      }

      case 'tag-add': {
        const idx = entity.tags.indexOf(action.tag)
        if (idx !== -1) entity.tags.splice(idx, 1)

        return { action: 'tag-remove', tag: action.tag }
      }

      case 'tag-remove': {
        entity.tags.push(action.tag)

        console.log(entity.tags)
        return { action: 'tag-add', tag: action.tag }
      }
    }
  }

  public undo(): boolean {
    const entry = this.#undoEntries.pop()
    if (!entry) return false

    const $game = game('client', true)
    switch (entry.type) {
      case 'create': {
        const entity = $game.lookup(entry.uid)
        if (!entity) return false

        $game.destroy(entity)
        entry.definition.uid = entry.uid
        this.#redoEntries.push(entry)

        window.sendPacket?.({
          t: 'DestroyEntity',
          entity_id: entry.uid,
        })

        break
      }

      case 'delete': {
        const entity = $game.spawn(entry.definition)
        if (!entity) return false

        entry.uid = entity.uid
        entry.definition.uid = entity.uid
        this.#redoEntries.push(entry)

        window.sendPacket?.({
          t: 'SpawnEntity',
          definition: entry.definition,
        })

        break
      }

      case 'update': {
        const entity = $game.lookup(entry.uid)
        if (!entity || entry.actions.length === 0) return false

        const redo = entry.actions.map(action => this.applyUpdate(entity, action))
        this.#redoEntries.push({
          type: 'update',
          uid: entry.uid,
          // @ts-expect-error length bounds
          actions: redo,
        })

        break
      }
    }

    this.events.emit('onUndo')
    return true
  }

  public redo(): boolean {
    const entry = this.#redoEntries.pop()
    if (!entry) return false

    const $game = game('client', true)
    switch (entry.type) {
      case 'create': {
        const entity = $game.spawn(entry.definition)
        if (!entity) return false

        this.recordCreated(entity)
        window.sendPacket?.({
          t: 'SpawnEntity',
          definition: entry.definition,
        })

        break
      }

      case 'delete': {
        const entity = $game.lookup(entry.uid)
        if (!entity) return false

        $game.destroy(entity)
        this.recordDeleted(entity)

        window.sendPacket?.({
          t: 'DestroyEntity',
          entity_id: entry.uid,
        })

        break
      }

      case 'update': {
        const entity = $game.lookup(entry.uid)
        if (!entity || entry.actions.length === 0) return false

        const undo = entry.actions.map(action => this.applyUpdate(entity, action))
        this.#undoEntries.push({
          type: 'update',
          uid: entry.uid,
          // @ts-expect-error length bounds
          actions: undo,
        })

        break
      }
    }

    this.events.emit('onRedo')
    return true
  }

  public copy(): boolean {
    const entity = this.#selected.value
    if (!entity) return false

    const definition = this.#cloneDefinition(entity.definition)
    delete definition.uid

    copy(JSON.stringify(definition))
    return true
  }
}

// import { isSpawnableEntity } from '@dreamlab.gg/core'
// import type { LooseSpawnableDefinition, SpawnableEntity } from '@dreamlab.gg/core'
// import type { EventHandler } from '@dreamlab.gg/core/events'
// import { useCommonEventListener, useGame, useNetwork } from '@dreamlab.gg/ui/react'
// import cuid2 from '@paralleldrive/cuid2'
// import type { FC, PropsWithChildren } from 'https://esm.sh/react@18.2.0'
// import { useCallback, useEffect, useMemo, useRef, useState } from 'https://esm.sh/react@18.2.0'
// import type { Selector } from '../entities/select'
// import { Notification } from './ui/notification'

// interface CreateAction {
//   type: 'create'
//   uid: string
// }

// interface DeleteAction {
//   type: 'delete'
//   definition: LooseSpawnableDefinition
// }

// interface EntityUpdateAction {
//   type: 'args' | 'tags' | 'transform'
//   definition: SpawnableEntity
// }

// export type Action = CreateAction | DeleteAction | EntityUpdateAction

// interface RedoAction {
//   action: Action
// }

// export interface HistoryData {
//   record(action: Action): void
//   undo(): Action | undefined
//   getActions(): Action[]
// }

// interface HistoryProps {
//   selector: Selector
//   history: HistoryData
// }

// export const History: FC<PropsWithChildren<HistoryProps>> = ({ children, selector, history }) => {
//   const game = useGame()
//   const network = useNetwork()
//   const spawnedAwaitingSelectionRef = useRef<string[]>([])

//   const redoHistory = useMemo(() => ({ value: [] as RedoAction[] }), [])

//   const clipboard = useRef<SpawnableEntity | null>(null)
//   const [notification, setNotification] = useState<string>('')

//   const showNotification = (message: string) => {
//     setNotification(message)
//     setTimeout(() => setNotification(''), 3_000)
//   }

//   const onSpawn = useCallback<EventHandler<'onSpawn'>>(
//     entity => {
//       const idx = spawnedAwaitingSelectionRef.current.indexOf(entity.uid)

//       if (idx !== -1) {
//         selector.select(entity)
//         spawnedAwaitingSelectionRef.current.splice(idx, 1)
//       }
//     },
//     [selector],
//   )

//   useCommonEventListener('onSpawn', onSpawn)

//   const spawn = useCallback(
//     (definition: LooseSpawnableDefinition): SpawnableEntity | undefined => {
//       if (network) {
//         void network.sendEntityCreate(definition)
//         spawnedAwaitingSelectionRef.current.push(definition.uid!)
//       } else {
//         const spawned = game.spawn(definition)
//         if (spawned) {
//           selector.select(spawned)
//           return spawned
//         }
//       }

//       return undefined
//     },
//     [game, network, selector],
//   )

//   const copyEntity = useCallback(() => {
//     if (!selector.selected) return
//     clipboard.current = selector.selected
//     showNotification('Copied!')
//   }, [selector.selected])

//   const pasteEntity = useCallback(async () => {
//     if (clipboard.current) {
//       const uid = cuid2.createId()
//       const cursorPosition = game.client.inputs.getCursor()
//       const position = cursorPosition ?? clipboard.current.definition.transform.position

//       const definition = {
//         ...clipboard.current.definition,
//         uid,
//         transform: {
//           ...clipboard.current.definition.transform,
//           position,
//         },
//       }

//       spawn(definition)
//       showNotification('Pasted.')
//       history.record({ type: 'create', uid: definition.uid })
//     }
//   }, [game.client.inputs, history, spawn])

//   const recordAction = useCallback(
//     (isUndo: boolean, action: Action) => {
//       if (isUndo) {
//         redoHistory.value.push({ action })
//       } else {
//         history.record(action)
//       }
//     },
//     [history, redoHistory.value],
//   )

//   const undoLastAction = useCallback(
//     async (action: Action | undefined, isUndo: boolean) => {
//       if (action) {
//         switch (action.type) {
//           case 'create': {
//             const spawnables = game.entities.filter(isSpawnableEntity)
//             const entity = spawnables.find(entity => entity.uid === action.uid)
//             if (entity) {
//               recordAction(isUndo, {
//                 type: 'delete',
//                 definition: entity.definition,
//               })

//               game.destroy(entity)
//               await network?.sendEntityDestroy(action.uid)
//               showNotification(`Create Change ${isUndo ? 'Undone.' : 'Redone.'}`)
//             }

//             break
//           }

//           case 'delete': {
//             spawn(action.definition)
//             if (action.definition.uid) {
//               recordAction(isUndo, {
//                 type: 'create',
//                 uid: action.definition.uid,
//               })

//               showNotification(`Delete Change ${isUndo ? 'Undone.' : 'Redone.'}`)
//             }

//             break
//           }

//           case 'transform': {
//             const spawnables = game.entities.filter(isSpawnableEntity)
//             const entity = spawnables.find(entity => entity.uid === action.definition.uid)
//             if (!entity) return

//             recordAction(isUndo, {
//               type: 'transform',
//               definition: JSON.parse(JSON.stringify(entity)),
//             })
//             selector.select(entity)
//             selector.events.emit('onTransformUpdate', entity.uid, action.definition.transform)
//             showNotification(`Positional Change ${isUndo ? 'Undone.' : 'Redone.'}`)
//             break
//           }

//           case 'args': {
//             const spawnables = game.entities.filter(isSpawnableEntity)
//             const entity = spawnables.find(entity => entity.uid === action.definition.uid)
//             if (!entity) return

//             recordAction(isUndo, {
//               type: 'args',
//               definition: JSON.parse(JSON.stringify(entity)),
//             })
//             selector.select(entity)
//             selector.events.emit('onArgsUpdate', entity.uid, action.definition.args)
//             selector.events.emit('onTransformUpdate', entity.uid, action.definition.transform)
//             showNotification(`Entity Arg Change ${isUndo ? 'Undone.' : 'Redone.'}`)
//             break
//           }

//           case 'tags': {
//             const spawnables = game.entities.filter(isSpawnableEntity)
//             const entity = spawnables.find(entity => entity.uid === action.definition.uid)
//             if (!entity) return

//             recordAction(isUndo, {
//               type: 'tags',
//               definition: JSON.parse(JSON.stringify(entity)),
//             })
//             selector.select(entity)
//             selector.events.emit('onTagsUpdate', entity.uid, action.definition.definition.tags)
//             showNotification(`Tag Change ${isUndo ? 'Undone.' : 'Redone.'}`)
//             break
//           }
//         }
//       }
//     },
//     [game, recordAction, network, spawn, selector],
//   )

//   const redoLastAction = useCallback(async () => {
//     const lastRedo = redoHistory.value[redoHistory.value.length - 1]
//     if (lastRedo) {
//       await undoLastAction(lastRedo.action, false)
//       redoHistory.value.pop()
//     }
//   }, [redoHistory.value, undoLastAction])

//   useEffect(() => {
//     const handleKeyDown = async (event: KeyboardEvent) => {
//       if (event.ctrlKey) {
//         switch (event.key.toLowerCase()) {
//           case 'c':
//             copyEntity()
//             break
//           case 'v':
//             await pasteEntity()
//             break
//           case 'z':
//             await undoLastAction(history.undo(), true)
//             break
//           case 'y':
//             await redoLastAction()
//             break
//         }
//       }
//     }

//     window.addEventListener('keydown', handleKeyDown)

//     return () => {
//       window.removeEventListener('keydown', handleKeyDown)
//     }
//   }, [
//     copyEntity,
//     pasteEntity,
//     undoLastAction,
//     selector.selected,
//     history,
//     redoHistory.value,
//     redoLastAction,
//   ])

//   return (
//     <>
//       <Notification message={notification} />
//       {children}
//     </>
//   )
// }
