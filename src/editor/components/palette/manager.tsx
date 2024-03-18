import type { SpawnableEntity } from '@dreamlab.gg/core'
import { useEffect, useState } from 'https://esm.sh/react@18.2.0'
import { styled } from 'https://esm.sh/styled-components@6.1.8?pin=v135'
import type { History } from '../../entities/history'
import type { Navigator } from '../../entities/navigator'
import type { Selector } from '../../entities/select'
import { Button, CollapseButton } from '../ui/buttons'
import { Container } from '../ui/container'
import { Assets } from './assets'
import { Inspector } from './inspector'
import { Spawnables } from './spawnables'

const PaletteContainer = styled(Container)<{ isCollapsed: boolean }>`
  top: 6rem;
  right: var(--margin);
  bottom: var(--margin);
  opacity: 0.7;
  transform: ${props => (props.isCollapsed ? 'translateX(92%)' : 'translateX(0)')};
  transition:
    transform 0.3s ease,
    opacity 0.3s ease;
  overflow-y: auto;
  padding-top: 0;

  &:hover {
    opacity: 1;
  }
`

const Header = styled.div`
  position: sticky;
  top: 0;
  z-index: 1;
  display: flex;
  flex-direction: column;
  background-color: rgba(230, 230, 230, 0.8);
  backdrop-filter: blur(5px);
`

const StickyCollapseButton = styled(CollapseButton)`
  align-self: flex-start;
  margin-bottom: 20px;
`

const ContentWrapper = styled.div`
  padding: 0.5rem;
`

const CATEGORIES = {
  SPAWNABLES: 'Spawnables',
  ASSETS: 'Assets',
  INSPECTOR: 'Properties',
}

interface PaletteManagerProps {
  selector: Selector
  navigator: Navigator
  history: History
}

export const PaletteManager: React.FC<PaletteManagerProps> = ({ selector, navigator, history }) => {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [currentCategory, setCurrentCategory] = useState(CATEGORIES.SPAWNABLES)
  const [selectedEntity, setSelectedEntity] = useState<SpawnableEntity | undefined>(undefined)

  const nextAPIBaseURL = window.localStorage.getItem('@dreamlab/NextAPIURL')
  const url = new URL(window.location.href)
  const jwt = url.searchParams.get('token')

  useEffect(() => {
    const handleSelect = () => {
      if (selector.selected) setCurrentCategory(CATEGORIES.INSPECTOR)
      // fixes onBlur not being called for arg edit fields when the inspector unmounts
      // TODO: Remove this once the args update as you type.
      setTimeout(() => setSelectedEntity(selector.selected), 2)
    }

    selector.events.addListener('onSelect', handleSelect)

    return () => {
      selector.events.removeListener('onSelect', handleSelect)
    }
  }, [selectedEntity, selector.events, selector.selected])

  return (
    <PaletteContainer isCollapsed={isCollapsed}>
      <Header>
        <StickyCollapseButton onClick={() => setIsCollapsed(prev => !prev)}>
          {isCollapsed ? (
            <svg height='16' viewBox='0 0 256 512' width='8' xmlns='http://www.w3.org/2000/svg'>
              <path d='M9.4 278.6c-12.5-12.5-12.5-32.8 0-45.3l128-128c9.2-9.2 22.9-11.9 34.9-6.9s19.8 16.6 19.8 29.6l0 256c0 12.9-7.8 24.6-19.8 29.6s-25.7 2.2-34.9-6.9l-128-128z' />
            </svg>
          ) : (
            <svg height='16' viewBox='0 0 256 512' width='8' xmlns='http://www.w3.org/2000/svg'>
              <path d='M246.6 278.6c12.5-12.5 12.5-32.8 0-45.3l-128-128c-9.2-9.2-22.9-11.9-34.9-6.9s-19.8 16.6-19.8 29.6l0 256c0 12.9 7.8 24.6 19.8 29.6s25.7 2.2 34.9-6.9l128-128z' />
            </svg>
          )}
        </StickyCollapseButton>
        {!isCollapsed && (
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-around',
              width: '100%',
            }}
          >
            {Object.values(CATEGORIES).map(category => (
              <Button
                key={category}
                onClick={() => setCurrentCategory(category)}
                style={{
                  backgroundColor: currentCategory === category ? '#2B59FF' : '#f2f2f2',
                  border: 'none',
                  color: currentCategory === category ? 'white' : '#333',
                  padding: '6px 12px',
                  borderRadius: '16px',
                  fontSize: '12px',
                  marginTop: '40px',
                  marginBottom: '10px',
                  fontWeight: 'bold',
                  textTransform: 'uppercase',
                  transition: 'background-color 0.3s ease, color 0.3s ease',
                  cursor: 'pointer',
                  boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
                }}
              >
                {category}
              </Button>
            ))}
          </div>
        )}
      </Header>
      {!isCollapsed && (
        <ContentWrapper>
          {currentCategory === CATEGORIES.SPAWNABLES && (
            <Spawnables history={history} navigator={navigator} selector={selector} />
          )}
          {currentCategory === CATEGORIES.ASSETS && (
            <Assets jwt={jwt} nextAPIBaseURL={nextAPIBaseURL} />
          )}
          {currentCategory === CATEGORIES.INSPECTOR &&
            (selectedEntity ? (
              <Inspector
                entity={selectedEntity}
                history={history}
                key={selectedEntity.uid}
                selector={selector}
              />
            ) : (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  height: '100vh',
                  backgroundColor: '#f2f2f2',
                  color: '#333',
                  fontFamily: 'Arial, sans-serif',
                  fontSize: '24px',
                  textAlign: 'center',
                  padding: '20px',
                  boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)',
                  borderRadius: '10px',
                  margin: 'auto',
                  width: '86%',
                }}
              >
                Select an entity to inspect its properties.
              </div>
            ))}
        </ContentWrapper>
      )}
    </PaletteContainer>
  )
}
