import {
  useGame,
  usePlayer,
  useRegisteredSpawnables,
} from '@dreamlab.gg/ui/react'
import { useCallback, useMemo } from 'https://esm.sh/react@18.2.0'
import type { FC } from 'https://esm.sh/react@18.2.0'
import { styled } from 'https://esm.sh/styled-components@6.1.1'
import type { Selector } from './select'

const Container = styled.div`
  --palette-margin: 1rem;

  pointer-events: auto;
  user-select: auto;

  width: max-content;
  min-width: 24rem;

  position: fixed;
  top: var(--palette-margin);
  right: var(--palette-margin);
  bottom: var(--palette-margin);

  padding: 1rem;
  border-radius: 0.5rem;
  background: grey;

  display: flex;
  flex-direction: column;
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
    <Container>
      <h1>Spawn Object</h1>

      {spawnable.map(([name]) => (
        <button key={name} type='button' onClick={async () => spawn(name)}>
          {name}
        </button>
      ))}
    </Container>
  )
}
