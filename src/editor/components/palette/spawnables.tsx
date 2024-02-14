import type { LooseSpawnableDefinition, SpawnableEntity } from '@dreamlab.gg/core'
import { useGame, useNetwork, useRegisteredSpawnables } from '@dreamlab.gg/ui/react'
import cuid2 from '@paralleldrive/cuid2'
import { useCallback } from 'https://esm.sh/v136/react@18.2.0'
import { styled } from 'https://esm.sh/v136/styled-components@6.1.8'
import type { History } from '../../entities/history'
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
  history: History
}

export const Spawnables: React.FC<SpawnablesProps> = ({ selector, navigator, history }) => {
  const game = useGame()
  const network = useNetwork()

  const registered = useRegisteredSpawnables()
  const spawnable = registered.filter(({ hasDefaults }) => hasDefaults)

  // make background not be able to be spawned manually
  const indexOfBackground = spawnable.findIndex(({ name }) => name === '@dreamlab/Background')
  spawnable.splice(indexOfBackground, 1)

  const spawn = useCallback(
    async (definition: Omit<LooseSpawnableDefinition, 'uid'> & { uid: string }) =>
      new Promise<SpawnableEntity | undefined>(resolve => {
        if (network) {
          const onSpawn = (entity: SpawnableEntity) => {
            if (entity.uid !== definition.uid) return

            game.events.common.removeListener('onSpawn', onSpawn)
            resolve(entity)
          }

          game.events.common.addListener('onSpawn', onSpawn)
          void network.sendEntityCreate(definition)
        } else {
          const entity = game.spawn(definition)
          resolve(entity)
        }
      }),
    [game, network],
  )

  const create = useCallback(
    async (entityName: string) => {
      const uid = cuid2.createId()
      const definition = {
        entity: entityName,
        args: {},
        transform: {
          position: navigator.position,
          zIndex: 100,
        },
        uid,
      } satisfies LooseSpawnableDefinition

      const entity = await spawn(definition)
      if (entity) {
        selector.select(entity)
        history.recordCreated(entity)
      }
    },
    [history, navigator.position, selector, spawn],
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
