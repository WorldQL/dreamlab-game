import { game } from '@dreamlab.gg/core/labs'
import { renderUI as render } from '@dreamlab.gg/ui/react'
import { StyleSheetManager } from 'https://esm.sh/styled-components@6.1.8?pin=v135'
import type { EditDetails } from '../editor'
import type { History } from '../entities/history'
import type { Navigator } from '../entities/navigator'
import type { Selector } from '../entities/select'
import { ConsoleLog } from './console/console-log'
import { PaletteManager } from './palette/manager'
import { SceneList } from './scene/list'
import { Card } from './ui/card'

export const renderUI = (
  selector: Selector,
  navigator: Navigator,
  history: History,
  hideUIElements: boolean,
  onToggleHideUIElements: (checked: boolean) => void,
  editDetails?: EditDetails,
) => {
  const styles = document.createElement('style')
  const ui = render(
    game(),
    <StyleSheetManager target={styles}>
      {/* {editDetails && <CLICommand details={editDetails} />} */}
      <SceneList
        editDetails={editDetails}
        hideUIElements={hideUIElements}
        history={history}
        onToggleHideUIElements={onToggleHideUIElements}
        selector={selector}
      />
      <PaletteManager history={history} navigator={navigator} selector={selector} />
      <ConsoleLog editDetails={editDetails} />
    </StyleSheetManager>,
  )

  const debug_ui = render(
    game(),
    <Card
      style={{
        position: 'absolute',
        bottom: '24px',
        left: '24px',
        padding: '10px',
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        color: '#1a1a1a',
        fontSize: '14px',
        borderRadius: '8px',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
        maxWidth: '300px',
        display: 'none',
      }}
    >
      <h3 style={{ fontSize: '16px', marginBottom: '2px', fontWeight: '500' }}>
        Welcome to the Editor!
      </h3>
      <p style={{ marginBottom: '0', fontSize: '16px', fontWeight: '600' }}>
        Click{' '}
        <span
          style={{
            backgroundColor: '#f0f0f0',
            padding: '4px',
            borderRadius: '4px',
          }}
        >
          `
        </span>{' '}
        to open the editor.
        <br />
        Click{' '}
        <span
          style={{
            backgroundColor: '#f0f0f0',
            padding: '4px',
            borderRadius: '4px',
          }}
        >
          P
        </span>{' '}
        to toggle debug mode.
      </p>
    </Card>,
  )

  ui.root.append(styles)
  return { ui, debug_ui }
}
