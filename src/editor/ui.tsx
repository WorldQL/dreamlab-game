import type { Game } from '@dreamlab.gg/core'
import { renderUI as render } from '@dreamlab.gg/ui/react'
import { StyleSheetManager } from 'https://esm.sh/styled-components@6.1.1'
import { Palette } from './palette'
import { SceneList } from './scene'
import type { Selector } from './select'

export const renderUI = (game: Game<false>, selector: Selector) => {
  const styles = document.createElement('style')
  const ui = render(
    game,
    <StyleSheetManager target={styles}>
      <SceneList selector={selector} />
      <Palette selector={selector} />
    </StyleSheetManager>,
    { interactable: false },
  )

  ui.root.append(styles)
  return ui
}
