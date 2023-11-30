import {
  useGame,
  useNetwork,
  usePlayer,
  useRegisteredSpawnables,
} from '@dreamlab.gg/ui/react'
import cuid2 from '@paralleldrive/cuid2'
import { useCallback, useMemo } from 'https://esm.sh/v136/react@18.2.0'
import type { FC } from 'https://esm.sh/v136/react@18.2.0'
import { styled } from 'https://esm.sh/v136/styled-components@6.1.1'
import { Button, Container } from './components'
import type { Selector } from './select'

const PaletteContainer = styled(Container)`
  top: 5rem;
  right: var(--margin);
  bottom: var(--margin);
  opacity: 0.7;

  &:hover {
    opacity: 1;
  }
`

const SpawnableList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  overflow-y: overlay;
  padding: 0.5rem 0;
`

export const Palette: FC<{ readonly selector: Selector }> = ({ selector }) => {
  const game = useGame()
  const network = useNetwork()
  const player = usePlayer()

  const registered = useRegisteredSpawnables()
  const spawnable = useMemo(
    () => registered.filter(([, fn]) => fn.hasDefaults),
    [registered],
  )

  const spawnedEntitiesAwaitingSelection: string[] = [];

  // This event is being fired three times??
  game.events.common.addListener('onSpawn', (entity) => {
    const idx = spawnedEntitiesAwaitingSelection.indexOf(entity.uid);
    if (idx !== -1) {
      selector.select(entity)
      spawnedEntitiesAwaitingSelection.splice(idx, 1);
    }
  })

  const spawn = useCallback(
    async (entity: string) => {
      if (!player) return

      const uid = cuid2.createId()

      const definition = {
        entity,
        args: {},
        transform: {
          position: player.position,
          zIndex: 100, // Spawn in front of player
        },
        uid,
      }

      if (network) {
        network.sendEntityCreate(definition)
        spawnedEntitiesAwaitingSelection.push(definition.uid)
      } else {
        const spawned = await game.spawn(definition)
        if (spawned) selector.select(spawned)
      }
    },
    [game, network, player, selector],
  )

  return (
    <PaletteContainer>
      <h1>Spawn Object</h1>

      <SpawnableList>
        {spawnable.map(([name]) => (
          <Button key={name} type='button' onClick={async () => spawn(name)}>
            {name}
          </Button>
        ))}
      </SpawnableList>
    </PaletteContainer>
  )
}
