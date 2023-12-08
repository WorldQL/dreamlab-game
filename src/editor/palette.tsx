import {
  useGame,
  useNetwork,
  usePlayer,
  useRegisteredSpawnables,
} from '@dreamlab.gg/ui/react'
import cuid2 from '@paralleldrive/cuid2'
import axios from 'axios'
import {
  useCallback,
  useEffect,
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
  padding: 36px;
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
  cursor: grab;

  &:hover {
    background-color: rgb(199 210 254);
    transition: background-color 0.1s ease;
  }
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

const url = new URL(window.location.href)
const jwt = url.searchParams.get('token')
const nextAPIBaseURL = window.localStorage.getItem('@dreamlab/NextAPIURL')

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
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    ;(async () => {
      // send an authenticated API request to get the user's image library
      const requestURL = nextAPIBaseURL + '/api/gameclient/listImages'
      const response = await axios.get(requestURL, {
        headers: { Authorization: jwt },
      })
      console.log(response)
      const imageAssets = []
      interface ImageData {
        name: string
        imageURL: string
      }
      for (const image of response.data as ImageData[]) {
        imageAssets.push({
          name: image.name ?? image.imageURL.split('/').at(-1),
          url: image.imageURL,
        })
      }

      console.log(imageAssets)
      setAssets(imageAssets)
      console.log(window.location.origin)

      // after we get the list of URLs from the user's library, we also load the images of everything that's currently in the game
      // then we remove duplicates by matching on URL
    })()
  }, [])

  const handleUploadClick = () => {
    if (!fileInputRef.current) return
    fileInputRef.current.click()
  }

  const handleFile = (file: File) => {
    const reader = new FileReader()
    reader.addEventListener('load', async ev => {
      const requestURL = nextAPIBaseURL + '/api/gameclient/uploadImage'

      const response = await axios.post(
        requestURL,
        { imageBase64: ev.target?.result, name: file.name },
        { headers: { Authorization: jwt } },
      )
      console.log(response)
      setAssets(prev => [
        ...prev,
        { name: file.name, url: response.data.imageURL },
      ])
    })

    reader.readAsDataURL(file)
  }

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      handleFile(file)
    }
  }

  const handleDrop = (ev: React.DragEvent<HTMLDivElement>): void => {
    ev.preventDefault()
    setDragOver(false)
    const files = ev.dataTransfer.files
    if (files && files.length > 0) {
      const file = files[0]
      handleFile(file)
    }
  }

  const handleDragEnter = (ev: React.DragEvent<HTMLDivElement>): void => {
    ev.preventDefault()
    setDragOver(true)
  }

  const handleDragLeave = (ev: React.DragEvent<HTMLDivElement>): void => {
    ev.preventDefault()
    setDragOver(false)
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
            <>
              <h1>Assets</h1>
              <AssetUploader
                onDragOver={ev => {
                  ev.preventDefault()
                }}
                onDrop={handleDrop}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onClick={handleUploadClick}
                className={dragOver ? 'drag-over' : ''}
              >
                Drag and drop files or click here
                <input
                  type='file'
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  style={{
                    display: 'none',
                  }}
                />
              </AssetUploader>
              <AssetList>
                {assets.map((asset, index) => (
                  <AssetItem
                    key={index}
                    draggable
                    onDragStart={ev =>
                      ev.dataTransfer.setData('text/plain', asset.url)
                    }
                  >
                    <ImagePreview src={asset.url} alt={asset.name} />
                    <span>{asset.name}</span>
                  </AssetItem>
                ))}
              </AssetList>
            </>
          )}
        </>
      )}
    </PaletteContainer>
  )
}
