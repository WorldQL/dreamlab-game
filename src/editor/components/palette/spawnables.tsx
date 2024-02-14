import type { LooseSpawnableDefinition } from '@dreamlab.gg/core'
import type { EventHandler } from '@dreamlab.gg/core/events'
import {
  useCommonEventListener,
  useGame,
  useNetwork,
  useRegisteredSpawnables,
} from '@dreamlab.gg/ui/react'
import cuid2 from '@paralleldrive/cuid2'
import { useCallback, useRef } from 'https://esm.sh/v136/react@18.2.0'
import { styled } from 'https://esm.sh/v136/styled-components@6.1.8'
import type { Navigator } from '../../entities/navigator'
import type { Selector } from '../../entities/select'
import type { HistoryData } from '../history'
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
  history: HistoryData
}

export const Spawnables: React.FC<SpawnablesProps> = ({ selector, navigator, history }) => {
  const game = useGame()
  const network = useNetwork()
  const spawnedAwaitingSelectionRef = useRef<string[]>([])

  const registered = useRegisteredSpawnables()
  const spawnable = registered.filter(({ hasDefaults }) => hasDefaults)

  // make background not be able to be spawned manually
  const indexOfBackground = spawnable.findIndex(({ name }) => name === '@dreamlab/Background')
  spawnable.splice(indexOfBackground, 1)

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
          zIndex: 100,
        },
        uid,
      } satisfies LooseSpawnableDefinition

      await spawn(definition)
      history.record({ type: 'create', uid: definition.uid })
    },
    [history, navigator.position, spawn],
  )

  return (
    <div>
      <h3>Spawn Object</h3>
      <SpawnableList>
        {spawnable.map(({ name }) => (
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
