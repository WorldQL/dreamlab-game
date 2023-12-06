import type { Game } from '@dreamlab.gg/core'
import { renderUI as render } from '@dreamlab.gg/ui/react'
import { StyleSheetManager } from 'https://esm.sh/v136/styled-components@6.1.1'
import { Palette } from './palette'
import { SceneList } from './scene'
import type { Selector } from './select'

export const renderUI = (
  game: Game<false>,
  selector: Selector,
  scriptEditSecret?: string,
) => {
  const styles = document.createElement('style')
  const ui = render(
    game,
    <StyleSheetManager target={styles}>
      {/* TODO(Charlotte): display scriptEditSecret as part of npx command if it exists */}
      {scriptEditSecret && <></>}

      <SceneList selector={selector} />
      <Palette selector={selector} />
    </StyleSheetManager>,
    { interactable: false },
  )

  ui.root.append(styles)
  return ui
}
