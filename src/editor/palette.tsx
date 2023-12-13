import { isSpawnableEntity } from '@dreamlab.gg/core'
import type {
  LooseSpawnableDefinition,
  SpawnableEntity,
} from '@dreamlab.gg/core'
import type { EventHandler } from '@dreamlab.gg/core/events'
import {
  useCommonEventListener,
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
import type {
  ChangeEventHandler,
  DragEventHandler,
  FC,
} from 'https://esm.sh/v136/react@18.2.0'
import { styled } from 'https://esm.sh/v136/styled-components@6.1.1'
import { Button, Container } from './components'
import type { Action } from './editor'
import { CollapseButton, DeleteButton } from './scene'
import type { Selector } from './select'

interface PaletteContainerProps {
  isCollapsed: boolean
}

const PaletteContainer = styled(Container)<PaletteContainerProps>`
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

export const Palette: FC<{
  readonly selector: Selector
  history: {
    record(action: Action): void
    undo(): void
    getActions(): Action[]
  }
}> = ({ selector, history }) => {
  const game = useGame()
  const network = useNetwork()
  const player = usePlayer()

  const registered = useRegisteredSpawnables()
  const spawnable = useMemo(
    () => registered.filter(([, fn]) => fn.hasDefaults),
    [registered],
  )
  const [isCollapsed, setIsCollapsed] = useState(false)

  const spawnedAwaitingSelectionRef = useRef<string[]>([])
  const [currentCategory, setCurrentCategory] = useState(CATEGORIES.SPAWNABLES)
  interface ImageData {
    name: string
    imageURL: string
    id: string
  }
  const [assets, setAssets] = useState<ImageData[]>([])
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const clipboard = useRef<SpawnableEntity | null>(null)

  const refreshImages = useCallback(async () => {
    // send an authenticated API request to get the user's image library
    const requestURL = nextAPIBaseURL + '/api/gameclient/listImages'
    const response = await axios.get(requestURL, {
      headers: { Authorization: jwt },
    })
    console.log(response)
    const imageAssets: ImageData[] = []

    for (const image of response.data as ImageData[]) {
      imageAssets.push({
        name: image.name ?? image.imageURL.split('/').at(-1),
        imageURL: image.imageURL,
        id: image.id,
      })
    }

    setAssets(imageAssets)

    // after we get the list of URLs from the user's library, we also load the images of everything that's currently in the game
    // then we remove duplicates by matching on URL
  }, [])

  useEffect(() => {
    void refreshImages()
  }, [refreshImages])

  const confirmDeleteImage = async (name: string, id: string) => {
    // eslint-disable-next-line no-alert
    const reply = confirm(
      `Delete "${name}"? Make sure it's not used by any objects in your game.`,
    )
    if (reply) {
      const requestURL = nextAPIBaseURL + '/api/gameclient/deleteImage'
      const response = await axios.post(
        requestURL,
        { imageID: id },
        {
          headers: { Authorization: jwt },
        },
      )
      if (response.status === 200) {
        await refreshImages()
      }
    }
  }

  const handleUploadClick = useCallback(() => {
    if (!fileInputRef.current) return
    fileInputRef.current.click()
  }, [])

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
        {
          name: file.name,
          imageURL: response.data.imageURL,
          id: response.data.id,
        },
      ])
    })

    reader.readAsDataURL(file)
  }

  const handleFileChange = useCallback<ChangeEventHandler<HTMLInputElement>>(
    ev => {
      const file = ev.target.files?.[0]
      if (file) handleFile(file)
    },
    [],
  )

  const handleDrop = useCallback<DragEventHandler<HTMLDivElement>>(ev => {
    ev.preventDefault()
    setDragOver(false)

    const files = ev.dataTransfer.files
    if (files && files.length > 0) {
      const file = files[0]
      handleFile(file)
    }
  }, [])

  const handleDragEnter = useCallback<DragEventHandler<HTMLDivElement>>(ev => {
    ev.preventDefault()
    setDragOver(true)
  }, [])

  const handleDragLeave = useCallback<DragEventHandler<HTMLDivElement>>(ev => {
    ev.preventDefault()
    setDragOver(false)
  }, [])

  const onSpawn = useCallback<EventHandler<'onSpawn'>>(
    entity => {
      const idx = spawnedAwaitingSelectionRef.current.indexOf(entity.uid)

      if (idx !== -1) {
        selector.select(entity)
        spawnedAwaitingSelectionRef.current.splice(idx, 1)
      }
    },
    [selector],
  )

  useCommonEventListener('onSpawn', onSpawn)

  const spawn = useCallback(
    async (definition: LooseSpawnableDefinition) => {
      if (network) {
        void network.sendEntityCreate(definition)
        spawnedAwaitingSelectionRef.current.push(definition.uid!)
      } else {
        const spawned = await game.spawn(definition)
        if (spawned) {
          selector.select(spawned)
        }
      }
    },
    [game, network, selector],
  )

  const create = useCallback(
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
      } satisfies LooseSpawnableDefinition

      await spawn(definition)
      history.record({ type: 'create', uid: definition.uid })
    },
    [history, player, spawn],
  )

  const copyEntity = useCallback(() => {
    if (!selector.selected) return
    clipboard.current = selector.selected
  }, [selector.selected])

  const pasteEntity = useCallback(async () => {
    if (!player) return
    if (clipboard.current) {
      const uid = cuid2.createId()
      const cursorPosition = game.client.inputs.getCursor()
      const position =
        cursorPosition ?? clipboard.current.definition.transform.position

      const definition = {
        ...clipboard.current.definition,
        uid,
        transform: {
          ...clipboard.current.definition.transform,
          position,
        },
      }

      await spawn(definition)
      history.record({ type: 'create', uid: definition.uid })
    }
  }, [game.client.inputs, history, player, spawn])

  const undoLastAction = useCallback(async () => {
    const lastAction = history.getActions()[history.getActions().length - 1]
    if (lastAction) {
      if (lastAction.type === 'create') {
        const spawnables = game.entities.filter(isSpawnableEntity)
        const entity = spawnables.find(entity => entity.uid === lastAction.uid)
        if (entity) await game.destroy(entity)
        await network?.sendEntityDestroy(lastAction.uid)
      }

      if (lastAction.type === 'delete') {
        await spawn(lastAction.definition)
      }
    }

    history.undo()
  }, [history, game, network, spawn])

  useEffect(() => {
    const handleKeyDown = async (event: KeyboardEvent) => {
      if (event.ctrlKey) {
        switch (event.key.toLowerCase()) {
          case 'c':
            copyEntity()
            break
          case 'v':
            await pasteEntity()
            break
          case 'z':
            await undoLastAction()
            break
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [copyEntity, pasteEntity, undoLastAction, selector.selected])

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
                    onClick={async () => create(name)}
                    type='button'
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
                className={dragOver ? 'drag-over' : ''}
                onClick={handleUploadClick}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDragOver={ev => {
                  ev.preventDefault()
                }}
                onDrop={handleDrop}
              >
                Drag and drop files or click here
                <input
                  onChange={handleFileChange}
                  ref={fileInputRef}
                  style={{
                    display: 'none',
                  }}
                  type='file'
                />
              </AssetUploader>
              <AssetList>
                {assets.map(asset => (
                  <AssetItem
                    draggable
                    key={asset.id}
                    onDragStart={ev =>
                      ev.dataTransfer.setData('text/plain', asset.imageURL)
                    }
                  >
                    <ImagePreview
                      alt={asset.name}
                      src={asset.imageURL + '?cachebuster=123'}
                    />
                    <div
                      style={{
                        width: '250px',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                      }}
                    >
                      {asset.name}
                    </div>
                    <DeleteButton
                      onClick={async () => {
                        await confirmDeleteImage(asset.name, asset.id)
                      }}
                    >
                      <svg
                        className='w-6 h-6'
                        fill='currentColor'
                        viewBox='0 0 24 24'
                        xmlns='http://www.w3.org/2000/svg'
                      >
                        <path
                          clipRule='evenodd'
                          d='M16.5 4.478v.227a48.816 48.816 0 013.878.512.75.75 0 11-.256 1.478l-.209-.035-1.005 13.07a3 3 0 01-2.991 2.77H8.084a3 3 0 01-2.991-2.77L4.087 6.66l-.209.035a.75.75 0 01-.256-1.478A48.567 48.567 0 017.5 4.705v-.227c0-1.564 1.213-2.9 2.816-2.951a52.662 52.662 0 013.369 0c1.603.051 2.815 1.387 2.815 2.951zm-6.136-1.452a51.196 51.196 0 013.273 0C14.39 3.05 15 3.684 15 4.478v.113a49.488 49.488 0 00-6 0v-.113c0-.794.609-1.428 1.364-1.452zm-.355 5.945a.75.75 0 10-1.5.058l.347 9a.75.75 0 101.499-.058l-.346-9zm5.48.058a.75.75 0 10-1.498-.058l-.347 9a.75.75 0 001.5.058l.345-9z'
                          fillRule='evenodd'
                        />
                      </svg>
                    </DeleteButton>
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
