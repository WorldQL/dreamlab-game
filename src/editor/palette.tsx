import type { Game } from '@dreamlab.gg/core'
import { createBouncyBall } from '@dreamlab.gg/core/dist/entities'
import { renderUI as render } from '@dreamlab.gg/ui/react'
import type { FC } from 'https://esm.sh/react@18.2.0'
import type { CSSProperties } from 'react'

const cssPalette: CSSProperties = {
  '--palette-margin': '1rem',

  width: 'max-content',
  minWidth: '24rem',

  position: 'fixed',
  top: 'var(--palette-margin)',
  right: 'var(--palette-margin)',
  bottom: 'var(--palette-margin)',

  padding: '1rem',
  borderRadius: '.5rem',
  background: 'red',
}

const Palette: FC = () => {
  return <div style={cssPalette}>palette</div>
}

export const renderUI = (game: Game<false>): (() => void) => {
  return render(game, <Palette />)
}
