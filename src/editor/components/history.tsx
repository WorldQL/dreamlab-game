import { isSpawnableEntity } from '@dreamlab.gg/core'
import type {
  LooseSpawnableDefinition,
  SpawnableEntity,
} from '@dreamlab.gg/core'
import type { EventHandler } from '@dreamlab.gg/core/events'
import {
  useCommonEventListener,
  useGame,
  useNetwork,
} from '@dreamlab.gg/ui/react'
import cuid2 from '@paralleldrive/cuid2'
import type { FC, PropsWithChildren } from 'https://esm.sh/v136/react@18.2.0'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'https://esm.sh/v136/react@18.2.0'
import type { Selector } from '../entities/select'
import { Notification } from './ui/notification'

interface CreateAction {
  type: 'create'
  uid: string
}

interface DeleteAction {
  type: 'delete'
  definition: LooseSpawnableDefinition
}

interface EntityUpdateAction {
  type: 'args' | 'tags' | 'transform'
  definition: SpawnableEntity
}

export type Action = CreateAction | DeleteAction | EntityUpdateAction

interface RedoAction {
  action: Action
}

export interface HistoryData {
  record(action: Action): void
  undo(): Action | undefined
  getActions(): Action[]
}

interface HistoryProps {
  selector: Selector
  history: HistoryData
}

export const History: FC<PropsWithChildren<HistoryProps>> = ({
  children,
  selector,
  history,
}) => {
  const game = useGame()
  const network = useNetwork()
  const spawnedAwaitingSelectionRef = useRef<string[]>([])

  const redoHistory = useMemo(() => ({ value: [] as RedoAction[] }), [])

  const clipboard = useRef<SpawnableEntity | null>(null)
  const [notification, setNotification] = useState<string>('')

  const showNotification = (message: string) => {
    setNotification(message)
    setTimeout(() => setNotification(''), 3_000)
  }

  const onSpawn = useCallback<EventHandler<'onSpawn'>>(
    entity => {
      const idx = spawnedAwaitingSelectionRef.current.indexOf(entity.uid)

      if (idx !== -1) {
        selector.select(entity)
        spawnedAwaitingSelectionRef.current.splice(idx, 1)
      }
    },
    [selector],
  )

  useCommonEventListener('onSpawn', onSpawn)

  const spawn = useCallback(
    async (
      definition: LooseSpawnableDefinition,
    ): Promise<SpawnableEntity | undefined> => {
      if (network) {
        void network.sendEntityCreate(definition)
        spawnedAwaitingSelectionRef.current.push(definition.uid!)
      } else {
        const spawned = await game.spawn(definition)
        if (spawned) {
          selector.select(spawned)
          return spawned
        }
      }

      return undefined
    },
    [game, network, selector],
  )

  const copyEntity = useCallback(() => {
    if (!selector.selected) return
    clipboard.current = selector.selected
    showNotification('Copied!')
  }, [selector.selected])

  const pasteEntity = useCallback(async () => {
    if (clipboard.current) {
      const uid = cuid2.createId()
      const cursorPosition = game.client.inputs.getCursor()
      const position =
        cursorPosition ?? clipboard.current.definition.transform.position

      const definition = {
        ...clipboard.current.definition,
        uid,
        transform: {
          ...clipboard.current.definition.transform,
          position,
        },
      }

      await spawn(definition)
      showNotification('Pasted.')
      history.record({ type: 'create', uid: definition.uid })
    }
  }, [game.client.inputs, history, spawn])

  const recordAction = useCallback(
    (isUndo: boolean, action: Action) => {
      if (isUndo) {
        redoHistory.value.push({ action })
      } else {
        history.record(action)
      }
    },
    [history, redoHistory.value],
  )

  const undoLastAction = useCallback(
    async (action: Action | undefined, isUndo: boolean) => {
      if (action) {
        switch (action.type) {
          case 'create': {
            const spawnables = game.entities.filter(isSpawnableEntity)
            const entity = spawnables.find(entity => entity.uid === action.uid)
            if (entity) {
              recordAction(isUndo, {
                type: 'delete',
                definition: entity.definition,
              })
              await game.destroy(entity)
              await network?.sendEntityDestroy(action.uid)
              showNotification(
                `Create Change ${isUndo ? 'Undone.' : 'Redone.'}`,
              )
            }

            break
          }

          case 'delete': {
            await spawn(action.definition)
            if (action.definition.uid) {
              recordAction(isUndo, {
                type: 'create',
                uid: action.definition.uid,
              })
              showNotification(
                `Delete Change ${isUndo ? 'Undone.' : 'Redone.'}`,
              )
            }

            break
          }

          case 'transform': {
            const spawnables = game.entities.filter(isSpawnableEntity)
            const entity = spawnables.find(
              entity => entity.uid === action.definition.uid,
            )
            if (!entity) return

            recordAction(isUndo, {
              type: 'transform',
              definition: JSON.parse(JSON.stringify(entity)),
            })
            selector.select(entity)
            selector.events.emit(
              'onTransformUpdate',
              entity.uid,
              action.definition.transform,
            )
            showNotification(
              `Positional Change ${isUndo ? 'Undone.' : 'Redone.'}`,
            )
            break
          }

          case 'args': {
            const spawnables = game.entities.filter(isSpawnableEntity)
            const entity = spawnables.find(
              entity => entity.uid === action.definition.uid,
            )
            if (!entity) return

            recordAction(isUndo, {
              type: 'args',
              definition: JSON.parse(JSON.stringify(entity)),
            })
            selector.select(entity)
            selector.events.emit(
              'onArgsUpdate',
              entity.uid,
              action.definition.args,
            )
            selector.events.emit(
              'onTransformUpdate',
              entity.uid,
              action.definition.transform,
            )
            showNotification(
              `Entity Arg Change ${isUndo ? 'Undone.' : 'Redone.'}`,
            )
            break
          }

          case 'tags': {
            const spawnables = game.entities.filter(isSpawnableEntity)
            const entity = spawnables.find(
              entity => entity.uid === action.definition.uid,
            )
            if (!entity) return

            recordAction(isUndo, {
              type: 'tags',
              definition: JSON.parse(JSON.stringify(entity)),
            })
            selector.select(entity)
            selector.events.emit(
              'onTagsUpdate',
              entity.uid,
              action.definition.definition.tags,
            )
            showNotification(`Tag Change ${isUndo ? 'Undone.' : 'Redone.'}`)
            break
          }
        }
      }
    },
    [game, recordAction, network, spawn, selector],
  )

  const redoLastAction = useCallback(async () => {
    const lastRedo = redoHistory.value[redoHistory.value.length - 1]
    if (lastRedo) {
      await undoLastAction(lastRedo.action, false)
      redoHistory.value.pop()
    }
  }, [redoHistory.value, undoLastAction])

  useEffect(() => {
    const handleKeyDown = async (event: KeyboardEvent) => {
      if (event.ctrlKey) {
        switch (event.key.toLowerCase()) {
          case 'c':
            copyEntity()
            break
          case 'v':
            await pasteEntity()
            break
          case 'z':
            await undoLastAction(history.undo(), true)
            break
          case 'y':
            await redoLastAction()
            break
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [
    copyEntity,
    pasteEntity,
    undoLastAction,
    selector.selected,
    history,
    redoHistory.value,
    redoLastAction,
  ])

  return (
    <>
      <Notification message={notification} />
      {children}
    </>
  )
}
