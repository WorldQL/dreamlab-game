import {
  useGame,
  usePlayer,
  useRegisteredSpawnables,
} from '@dreamlab.gg/ui/react'
import { useCallback, useMemo } from 'https://esm.sh/react@18.2.0'
import type { FC } from 'https://esm.sh/react@18.2.0'
import { styled } from 'https://esm.sh/styled-components@6.1.1'
import { Button, Container } from './components'
import type { Selector } from './select'

const PaletteContainer = styled(Container)`
  top: var(--margin);
  right: var(--margin);
  bottom: var(--margin);
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
  const player = usePlayer()

  const registered = useRegisteredSpawnables()
  const spawnable = useMemo(
    () => registered.filter(([, fn]) => fn.hasDefaults),
    [registered],
  )

  const spawn = useCallback(
    async (entity: string) => {
      if (!player) return

      const spawned = await game.spawn({
        entity,
        args: {},
        transform: {
          position: player.position,
          zIndex: 100, // Spawn in front of player
        },
      })

      selector.select(spawned)
    },
    [game, player, selector],
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
