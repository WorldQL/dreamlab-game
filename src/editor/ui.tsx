import type { Game } from '@dreamlab.gg/core'
import { renderUI as render } from '@dreamlab.gg/ui/react'
import { StyleSheetManager } from 'https://esm.sh/v136/styled-components@6.1.1'
import { CLICommand } from './command'
import type { Action, EditDetails } from './editor'
import { Palette } from './palette'
import { SceneList } from './scene'
import type { Selector } from './select'

export const renderUI = (
  game: Game<false>,
  selector: Selector,
  history: {
    record(action: Action): void
    undo(): void
    getActions(): Action[]
  },
  editDetails?: EditDetails,
) => {
  const styles = document.createElement('style')
  const ui = render(
    game,
    <StyleSheetManager target={styles}>
      {editDetails && <CLICommand details={editDetails} />}

      <SceneList history={history} selector={selector} />
      <Palette history={history} selector={selector} />
    </StyleSheetManager>,
    { interactable: false },
  )

  ui.root.append(styles)
  return ui
}
