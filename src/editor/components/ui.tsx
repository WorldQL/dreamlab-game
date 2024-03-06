import type { Game } from '@dreamlab.gg/core'
import { renderUI as render } from '@dreamlab.gg/ui/react'
import { StyleSheetManager } from 'https://esm.sh/v135/styled-components@6.1.8'
import type { EditDetails } from '../editor'
import type { Navigator } from '../entities/navigator'
import type { Selector } from '../entities/select'
import { CLICommand } from './command'
import { History } from './history'
import type { HistoryData } from './history'
import { PaletteManager } from './palette/manager'
import { SceneList } from './scene/list'

export const renderUI = (
  game: Game<false>,
  selector: Selector,
  navigator: Navigator,
  history: HistoryData,
  editDetails?: EditDetails,
) => {
  const styles = document.createElement('style')
  const ui = render(
    game,
    <StyleSheetManager target={styles}>
      <History history={history} selector={selector}>
        {editDetails && <CLICommand details={editDetails} />}

        <SceneList
          editDetails={editDetails}
          history={history}
          selector={selector}
        />
        <PaletteManager
          history={history}
          navigator={navigator}
          selector={selector}
        />
      </History>
    </StyleSheetManager>,
    { interactable: false },
  )

  ui.root.append(styles)
  return ui
}
