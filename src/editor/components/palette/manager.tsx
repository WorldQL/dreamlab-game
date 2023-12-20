import { useState } from 'https://esm.sh/v136/react@18.2.0'
import { styled } from 'https://esm.sh/v136/styled-components@6.1.1'
import type { Action } from '../../editor'
import type { Navigator } from '../../entities/navigator'
import type { Selector } from '../../entities/select'
import { Button, CollapseButton } from '../ui/buttons'
import { Container } from '../ui/container'
import { Assets } from './assets'
import { Spawnables } from './spawnables'

const PaletteContainer = styled(Container)<{ isCollapsed: boolean }>`
  top: 6rem;
  right: var(--margin);
  bottom: var(--margin);
  opacity: 0.7;
  transform: ${props =>
    props.isCollapsed ? 'translateX(92%)' : 'translateX(0)'};
  transition:
    transform 0.3s ease,
    opacity 0.3s ease;

  &:hover {
    opacity: 1;
  }
`

const CATEGORIES = {
  SPAWNABLES: 'Spawnables',
  ASSETS: 'Assets',
}

interface PaletteManagerProps {
  selector: Selector
  navigator: Navigator
  history: {
    record(action: Action): void
    undo(): void
    getActions(): Action[]
  }
}

export const PaletteManager: React.FC<PaletteManagerProps> = ({
  selector,
  navigator,
  history,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [currentCategory, setCurrentCategory] = useState(CATEGORIES.SPAWNABLES)

  const nextAPIBaseURL = window.localStorage.getItem('@dreamlab/NextAPIURL')
  const url = new URL(window.location.href)
  const jwt = url.searchParams.get('token')

  return (
    <PaletteContainer isCollapsed={isCollapsed}>
      <CollapseButton
        onClick={() => setIsCollapsed(prev => !prev)}
        style={{ left: '0.3rem' }}
      >
        {isCollapsed ? '✚' : '─'}
      </CollapseButton>
      {!isCollapsed && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-around' }}>
            {Object.values(CATEGORIES).map(category => (
              <Button
                key={category}
                onClick={() => setCurrentCategory(category)}
                style={{
                  backgroundColor:
                    currentCategory === category ? 'lightgrey' : 'transparent',
                  border: 'none',
                  color: 'black',
                }}
              >
                {category}
              </Button>
            ))}
          </div>

          {currentCategory === CATEGORIES.SPAWNABLES && (
            <Spawnables
              history={history}
              navigator={navigator}
              selector={selector}
            />
          )}

          {currentCategory === CATEGORIES.ASSETS && (
            <Assets jwt={jwt} nextAPIBaseURL={nextAPIBaseURL} />
          )}
        </>
      )}
    </PaletteContainer>
  )
}