import type { Game } from '@dreamlab.gg/core'
import {
  renderUI as render,
  useGame,
  usePlayer,
  useRegistered,
} from '@dreamlab.gg/ui/react'
import { useCallback, useMemo } from 'https://esm.sh/react@18.2.0'
import type { FC } from 'https://esm.sh/react@18.2.0'
import type { CSSProperties } from 'react'

const cssPalette: CSSProperties = {
  '--palette-margin': '1rem',
  pointerEvents: 'all',
  userSelect: 'auto',

  width: 'max-content',
  minWidth: '24rem',

  position: 'fixed',
  top: 'var(--palette-margin)',
  right: 'var(--palette-margin)',
  bottom: 'var(--palette-margin)',

  padding: '1rem',
  borderRadius: '.5rem',
  background: 'grey',

  display: 'flex',
  flexDirection: 'column',
}

const Palette: FC = () => {
  const game = useGame()
  const player = usePlayer()

  const registered = useRegistered()
  const spawnable = useMemo(
    () => registered.filter(([, fn]) => fn.hasDefaults),
    [registered],
  )

  const spawn = useCallback(
    (entity: string) => {
      if (!player) return

      void game.spawn({
        entity,
        args: {},
        transform: {
          position: player.position,
          zIndex: 100, // Spawn in front of player
        },
      })
    },
    [game, player],
  )

  return (
    <div style={cssPalette}>
      <h1>Spawn Object</h1>

      {spawnable.map(([name]) => (
        <button key={name} type='button' onClick={() => spawn(name)}>
          {name}
        </button>
      ))}
    </div>
  )
}

export const renderUI = (game: Game<false>) => {
  return render(game, <Palette />)
}
