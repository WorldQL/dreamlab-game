import {
  useGame,
  useNetwork,
  usePlayer,
  useRegisteredSpawnables,
} from '@dreamlab.gg/ui/react'
import cuid2 from '@paralleldrive/cuid2'
import {
  useCallback,
  useMemo,
  useRef,
  useState,
} from 'https://esm.sh/v136/react@18.2.0'
import type { FC } from 'https://esm.sh/v136/react@18.2.0'
import { styled } from 'https://esm.sh/v136/styled-components@6.1.1'
import { Button, Container } from './components'
import { CollapseButton } from './scene'
import type { Selector } from './select'

interface PaletteContainerProps {
  isCollapsed: boolean
}

const PaletteContainer = styled(Container)<PaletteContainerProps>`
  top: 5rem;
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

const SpawnableList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  overflow-y: overlay;
  padding: 0.5rem 0;
`

const AssetUploader = styled.div`
  border: 2px dashed rgb(99 102 241);
  padding: 18px;
  text-align: center;
  cursor: pointer;
  margin-bottom: 10px;
  border-radius: 5px;
  background-color: #f8f9fa;
  &:hover,
  &.drag-over {
    background-color: #e2e6ea;
    border-color: #007bff;
  }
`

const AssetList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
  overflow-y: auto;
`

const AssetItem = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 5px;
  border-radius: 5px;
  background-color: #f8f9fa;
  border: 1px solid #ddd;
`

const ImagePreview = styled.img`
  width: 50px;
  height: 50px;
  object-fit: cover;
  border-radius: 5px;
`

const CATEGORIES = {
  SPAWNABLES: 'Spawnables',
  ASSETS: 'Assets',
}

export const Palette: FC<{ readonly selector: Selector }> = ({ selector }) => {
  const game = useGame()
  const network = useNetwork()
  const player = usePlayer()

  const registered = useRegisteredSpawnables()
  const spawnable = useMemo(
    () => registered.filter(([, fn]) => fn.hasDefaults),
    [registered],
  )
  const [isCollapsed, setIsCollapsed] = useState(false)

  const spawnedEntitiesAwaitingSelection: string[] = []
  const [currentCategory, setCurrentCategory] = useState(CATEGORIES.SPAWNABLES)

  const [assets, setAssets] = useState<{ name: string; url: string }[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleUploadClick = () => {
    if (!fileInputRef.current) return
    fileInputRef.current.click()
  }

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.addEventListener('load', ev => {
        setAssets(prev => [
          ...prev,
          { name: file.name, url: ev.target?.result as string },
        ])
      })

      reader.readAsDataURL(file)
    }
  }

  // This event is being fired three times??
  game.events.common.addListener('onSpawn', entity => {
    const idx = spawnedEntitiesAwaitingSelection.indexOf(entity.uid)
    if (idx !== -1) {
      selector.select(entity)
      spawnedEntitiesAwaitingSelection.splice(idx, 1)
    }
  })

  const spawn = useCallback(
    async (entity: string) => {
      if (!player) return

      const uid = cuid2.createId()

      const definition = {
        entity,
        args: {},
        transform: {
          position: player.position,
          zIndex: 100, // Spawn in front of player
        },
        uid,
      }

      if (network) {
        void network.sendEntityCreate(definition)
        spawnedEntitiesAwaitingSelection.push(definition.uid)
      } else {
        const spawned = await game.spawn(definition)
        if (spawned) selector.select(spawned)
      }
    },
    [game, network, player, selector],
  )

  return (
    <PaletteContainer isCollapsed={isCollapsed}>
      <CollapseButton
        onClick={() => setIsCollapsed(prev => !prev)}
        style={{
          left: '0.3rem',
        }}
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
            <>
              <h1>Spawn Object</h1>
              <SpawnableList>
                {spawnable.map(([name]) => (
                  <Button
                    key={name}
                    type='button'
                    onClick={async () => spawn(name)}
                  >
                    {name}
                  </Button>
                ))}
              </SpawnableList>
            </>
          )}

          {currentCategory === CATEGORIES.ASSETS && (
            <div>
              <h1>Assets</h1>
              <AssetUploader onClick={handleUploadClick}>
                Drag and drop files or click here
                <input
                  type='file'
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  style={{ display: 'none' }}
                />
              </AssetUploader>
              <AssetList>
                {assets.map((asset, index) => (
                  <AssetItem key={index}>
                    <ImagePreview src={asset.url} alt={asset.name} />
                    <span>{asset.name}</span>
                  </AssetItem>
                ))}
              </AssetList>
            </div>
          )}
        </>
      )}
    </PaletteContainer>
  )
}
