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
import {
  useCallback,
  useEffect,
  useRef,
} from 'https://esm.sh/v136/react@18.2.0'
import type { Selector } from '../entities/select'

interface CreateAction {
  type: 'create'
  uid: string
}

interface DeleteAction {
  type: 'delete'
  definition: LooseSpawnableDefinition
}

interface EntityUpdateAction {
  type: 'args' | 'transform'
  definition: SpawnableEntity
}

export type Action = CreateAction | DeleteAction | EntityUpdateAction

export interface HistoryData {
  record(action: Action): void
  undo(): void
  getActions(): Action[]
}

interface HistoryProps {
  selector: Selector
  history: HistoryData
}

export const History: React.FC<HistoryProps> = ({ selector, history }) => {
  const game = useGame()
  const network = useNetwork()
  const spawnedAwaitingSelectionRef = useRef<string[]>([])
  const clipboard = useRef<SpawnableEntity | null>(null)

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
    async (definition: LooseSpawnableDefinition) => {
      if (network) {
        void network.sendEntityCreate(definition)
        spawnedAwaitingSelectionRef.current.push(definition.uid!)
      } else {
        const spawned = await game.spawn(definition)
        if (spawned) {
          selector.select(spawned)
        }
      }
    },
    [game, network, selector],
  )

  const copyEntity = useCallback(() => {
    if (!selector.selected) return
    clipboard.current = selector.selected
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
      history.record({ type: 'create', uid: definition.uid })
    }
  }, [game.client.inputs, history, spawn])

  const undoLastAction = useCallback(async () => {
    const lastAction = history.getActions()[history.getActions().length - 1]
    if (lastAction) {
      switch (lastAction.type) {
        case 'create': {
          const spawnables = game.entities.filter(isSpawnableEntity)
          const entity = spawnables.find(
            entity => entity.uid === lastAction.uid,
          )
          if (entity) await game.destroy(entity)
          await network?.sendEntityDestroy(lastAction.uid)

          break
        }

        case 'delete': {
          await spawn(lastAction.definition)

          break
        }

        case 'transform': {
          const spawnables = game.entities.filter(isSpawnableEntity)
          const entity = spawnables.find(
            entity => entity.uid === lastAction.definition.uid,
          )
          if (!entity) return

          selector.select(entity)
          selector.events.emit(
            'onTransformManualUpdate',
            entity.uid,
            lastAction.definition.transform,
          )
          selector.events.emit(
            'onTransformUpdate',
            entity.uid,
            lastAction.definition.transform,
          )

          break
        }

        case 'args': {
          const spawnables = game.entities.filter(isSpawnableEntity)
          const entity = spawnables.find(
            entity => entity.uid === lastAction.definition.uid,
          )
          if (!entity) return

          selector.select(entity)
          selector.events.emit(
            'onArgsUpdate',
            entity.uid,
            lastAction.definition.args,
          )

          for (const key of Object.keys(lastAction.definition.args)) {
            const value = lastAction.definition.args[key]
            const entityValue = entity.args[key]

            if (value !== entityValue) {
              selector.events.emit('onArgsManualUpdate', entity.uid, key, value)
            }
          }

          break
        }
      }
    }

    history.undo()
  }, [history, game, network, spawn, selector])

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
            await undoLastAction()
            break
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [copyEntity, pasteEntity, undoLastAction, selector.selected])

  return <div />
}
