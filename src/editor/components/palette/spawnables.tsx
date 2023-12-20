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
  useRegisteredSpawnables,
} from '@dreamlab.gg/ui/react'
import cuid2 from '@paralleldrive/cuid2'
import {
  useCallback,
  useEffect,
  useRef,
} from 'https://esm.sh/v136/react@18.2.0'
import { styled } from 'https://esm.sh/v136/styled-components@6.1.1'
import type { Action } from '../../editor'
import type { Navigator } from '../../entities/navigator'
import type { Selector } from '../../entities/select'
import { Button } from '../ui/buttons'

const SpawnableList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  overflow-y: overlay;
  padding: 0.5rem 0;
`
interface SpawnablesProps {
  selector: Selector
  navigator: Navigator
  history: {
    record(action: Action): void
    undo(): void
    getActions(): Action[]
  }
}

export const Spawnables: React.FC<SpawnablesProps> = ({
  selector,
  navigator,
  history,
}) => {
  const game = useGame()
  const network = useNetwork()
  const spawnedAwaitingSelectionRef = useRef<string[]>([])
  const clipboard = useRef<SpawnableEntity | null>(null)

  const registered = useRegisteredSpawnables()
  const spawnable = registered.filter(([, fn]) => fn.hasDefaults)

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

  const create = useCallback(
    async (entity: string) => {
      const uid = cuid2.createId()
      const definition = {
        entity,
        args: {},
        transform: {
          position: navigator.position,
          zIndex: 100, // Spawn in front of player
        },
        uid,
      } satisfies LooseSpawnableDefinition

      await spawn(definition)
      history.record({ type: 'create', uid: definition.uid })
    },
    [history, navigator.position, spawn],
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
      if (lastAction.type === 'create') {
        const spawnables = game.entities.filter(isSpawnableEntity)
        const entity = spawnables.find(entity => entity.uid === lastAction.uid)
        if (entity) await game.destroy(entity)
        await network?.sendEntityDestroy(lastAction.uid)
      }

      if (lastAction.type === 'delete') {
        await spawn(lastAction.definition)
      }
    }

    history.undo()
  }, [history, game, network, spawn])

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

  return (
    <div>
      <h1>Spawn Object</h1>
      <SpawnableList>
        {spawnable.map(([name]) => (
          <Button
            key={name}
            onClick={async () => create(name)}
            style={{ textAlign: 'left' }}
            type='button'
          >
            {name}
          </Button>
        ))}
      </SpawnableList>
    </div>
  )
}
