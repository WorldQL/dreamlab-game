import { game } from '@dreamlab.gg/core/labs'
import { renderUI as render } from '@dreamlab.gg/ui/react'
import { StyleSheetManager } from 'https://esm.sh/styled-components@6.1.8?pin=v135'
import type { EditDetails } from '../editor'
import type { History } from '../entities/history'
import type { Navigator } from '../entities/navigator'
import type { Selector } from '../entities/select'
import { CLICommand } from './command'
import { PaletteManager } from './palette/manager'
import { SceneList } from './scene/list'

export const renderUI = (
  selector: Selector,
  navigator: Navigator,
  history: History,
  editDetails?: EditDetails,
) => {
  const styles = document.createElement('style')
  const ui = render(
    game(),
    <StyleSheetManager target={styles}>
      {editDetails && <CLICommand details={editDetails} />}

      <SceneList editDetails={editDetails} history={history} selector={selector} />
      <PaletteManager history={history} navigator={navigator} selector={selector} />
    </StyleSheetManager>,
    { interactable: false },
  )

  ui.root.append(styles)
  return ui
}
