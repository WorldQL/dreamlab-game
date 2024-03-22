/* eslint-disable unicorn/prefer-string-replace-all */
import type { SpawnableEntity } from '@dreamlab.gg/core'
import { useSpawnableEntities } from '@dreamlab.gg/ui/dist/react'
import axios from 'axios'
import { useCallback, useEffect, useRef, useState } from 'https://esm.sh/react@18.2.0'
import type { ChangeEventHandler, DragEventHandler } from 'https://esm.sh/react@18.2.0'
import { styled } from 'https://esm.sh/styled-components@6.1.8?pin=v135'
import { DeleteButton, LinkButton } from '../ui/buttons'

const AssetUploader = styled.div`
  border: 2px dashed #6b7280;
  padding: 36px;
  text-align: center;
  cursor: pointer;
  margin-top: 10px;
  margin-bottom: 10px;
  border-radius: 8px;
  background-color: #f9fafb;
  transition:
    background-color 0.2s ease,
    border-color 0.2s ease;

  &:hover,
  &.drag-over {
    background-color: #f3f4f6;
    border-color: #3b82f6;
  }
`

const SearchBar = styled.input`
  width: 91%;
  padding: 12px;
  border: none;
  border-radius: 8px;
  background-color: #f3f4f6;
  font-size: 16px;
  color: #1f2937;
  margin-bottom: 16px;
  transition: box-shadow 0.2s ease;

  &:focus {
    outline: none;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.3);
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
  justify-content: space-between;
  gap: 10px;
  font-size: 13px;
  padding: 5px;
  border-radius: 5px;
  background-color: #f8f9fa;
  border: 1px solid #ddd;
  cursor: grab;
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease;

  &:hover {
    transform: translateY(-2px);
    box-shadow:
      0 4px 6px -1px rgba(0, 0, 0, 0.1),
      0 2px 4px -1px rgba(0, 0, 0, 0.06);
  }
`

const ImagePreview = styled.img`
  width: 50px;
  height: 50px;
  object-fit: cover;
  border-radius: 5px;
`

const CopyButton = styled.button`
  background: none;
  border: none;
  cursor: pointer;
  color: #4b5563;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4px;
  border-radius: 4px;
  transition: background-color 0.2s ease;

  &:hover {
    color: #1f2937;
    background-color: #e5e7eb;
  }
`

const FilterOptions = styled.div`
  display: flex;
  gap: 16px;
  margin-bottom: 16px;
`

const FilterOption = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  user-select: none;
`

const FilterLabel = styled.label`
  font-size: 14px;
  color: #4b5563;
`

const FilterRadio = styled.div<{ checked: boolean }>`
  width: 16px;
  height: 12px;
  border-radius: 50%;
  border: 2px solid #4b5563;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: border-color 0.2s ease;

  &::after {
    content: '';
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background-color: #2563eb;
    opacity: ${props => (props.checked ? 1 : 0)};
    transition: opacity 0.2s ease;
  }

  &:hover {
    border-color: #2563eb;
  }
`
interface ImageData {
  name: string
  imageURL: string
  id: string
}

interface AssetsProps {
  readonly nextAPIBaseURL: string | null
  readonly jwt: string | null
}

export const Assets: React.FC<AssetsProps> = ({ nextAPIBaseURL, jwt }) => {
  const [userAssets, setUserAssets] = useState<ImageData[]>([])
  const [worldAssets, setWorldAssets] = useState<ImageData[]>([])
  const [dragOver, setDragOver] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [newName, setNewName] = useState<string>('')
  const [copiedAssetId, setCopiedAssetId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const entities = useSpawnableEntities()
  const [entitiesCopy] = useState<SpawnableEntity[]>([...entities])
  const [searchTerm, setSearchTerm] = useState('')

  const [filterOption, setFilterOption] = useState<'all' | 'from user' | 'from world'>('all')

  const filteredAssets = (() => {
    let assets: ImageData[] = []

    switch (filterOption) {
      case 'all': {
        assets = [...userAssets, ...worldAssets]

        break
      }

      case 'from user': {
        assets = userAssets

        break
      }

      case 'from world': {
        assets = worldAssets

        break
      }
      // No default
    }

    return assets.filter(asset => asset.name.toLowerCase().includes(searchTerm.toLowerCase()))
  })()

  const handleCopyUrl = (assetId: string, imageURL: string) => {
    const tempInput = document.createElement('input')
    tempInput.value = imageURL
    document.body.append(tempInput)
    tempInput.select()

    try {
      document.execCommand('copy')
      setCopiedAssetId(assetId)
      setTimeout(() => {
        setCopiedAssetId(null)
      }, 2_000)
    } catch (error) {
      console.error('Failed to copy URL:', error)
    }

    tempInput.remove()
  }

  const refreshImages = useCallback(async () => {
    // send an authenticated API request to get the user's image library
    const requestURL = nextAPIBaseURL + '/api/gameclient/listImages'
    const response = await axios.get(requestURL, {
      headers: { Authorization: jwt },
    })
    console.log(response)
    const userImageAssets: ImageData[] = []
    const worldImageAssets: ImageData[] = []

    // these assets are from the user
    for (const image of response.data as ImageData[]) {
      userImageAssets.push({
        name: image.name ?? image.imageURL.split('/').at(-1),
        imageURL: image.imageURL,
        id: image.id,
      })
    }

    userImageAssets.reverse()

    // these assets are from the level
    for (const entity of entitiesCopy) {
      if (entity.definition.args.spriteSource) {
        const imageURL = entity.definition.args.spriteSource.url
        if (imageURL && !worldImageAssets.some(asset => asset.imageURL === imageURL)) {
          worldImageAssets.push({
            name: imageURL.split('/').pop() || '',
            imageURL,
            id: entity.uid,
          })
        }
      }
    }

    setUserAssets(userImageAssets)
    setWorldAssets(worldImageAssets)
  }, [entitiesCopy, jwt, nextAPIBaseURL])

  useEffect(() => {
    void refreshImages()
  }, [refreshImages])

  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible') {
        await refreshImages()
      }
    }

    // Add event listener
    document.addEventListener('visibilitychange', handleVisibilityChange)

    // Remove event listener on cleanup
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [refreshImages])

  const handleUploadClick = useCallback(() => {
    if (!fileInputRef.current) return
    fileInputRef.current.click()
  }, [])

  const handleFile = useCallback(
    (file: File) => {
      const reader = new FileReader()
      reader.addEventListener('load', async ev => {
        const requestURL = nextAPIBaseURL + '/api/gameclient/uploadImage'

        const response = await axios.post(
          requestURL,
          { imageBase64: ev.target?.result, name: file.name },
          { headers: { Authorization: jwt } },
        )
        setUserAssets(prev => [
          {
            name: file.name,
            imageURL: response.data.imageURL,
            id: response.data.id,
          },
          ...prev,
        ])
      })

      reader.readAsDataURL(file)
    },
    [nextAPIBaseURL, jwt],
  )

  const handleNameChange = useCallback((value: string) => {
    const sanitizedValue = value.replace(/\s+/g, '_').replace(/\W/g, '')
    setNewName(sanitizedValue)
  }, [])

  const handleEditName = async () => {
    if (editingId && newName.trim() !== '') {
      const finalName = newName.endsWith('.png') ? newName : `${newName}.png`
      const requestURL = `${nextAPIBaseURL}/api/gameclient/renameImage`
      await axios.post(
        requestURL,
        { imageID: editingId, newName: finalName },
        { headers: { Authorization: jwt } },
      )
      setEditingId(null)
      setNewName('')
      await refreshImages()
    }
  }

  const handleFileChange = useCallback<ChangeEventHandler<HTMLInputElement>>(
    ev => {
      const file = ev.target.files?.[0]
      if (file) handleFile(file)
    },
    [handleFile],
  )

  const handleDrop = useCallback<DragEventHandler<HTMLDivElement>>(
    ev => {
      ev.preventDefault()
      setDragOver(false)

      const files = ev.dataTransfer.files
      if (files && files.length > 0) {
        const file = files[0]
        handleFile(file)
      }
    },
    [handleFile],
  )

  const handleDragEnter = useCallback<DragEventHandler<HTMLDivElement>>(ev => {
    ev.preventDefault()
    setDragOver(true)
  }, [])

  const handleDragLeave = useCallback<DragEventHandler<HTMLDivElement>>(ev => {
    ev.preventDefault()
    setDragOver(false)
  }, [])

  const confirmDeleteImage = async (name: string, id: string) => {
    // eslint-disable-next-line no-alert
    const reply = confirm(`Delete "${name}"? Make sure it's not used by any objects in your game.`)
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

  return (
    <div>
      <AssetUploader
        className={dragOver ? 'drag-over' : ''}
        onClick={handleUploadClick}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={event => event.preventDefault()}
        onDrop={handleDrop}
      >
        Drag and drop files or click here to upload
        <input
          onChange={handleFileChange}
          ref={fileInputRef}
          style={{ display: 'none' }}
          type='file'
        />
      </AssetUploader>
      <div>
        <LinkButton
          href={nextAPIBaseURL + '/assets/create/object'}
          style={{
            display: 'block',
            textAlign: 'center',
            marginBottom: '8px',
          }}
          target='_blank'
        >
          Generate New Asset
        </LinkButton>
      </div>
      <SearchBar
        onChange={ev => setSearchTerm(ev.target.value)}
        onKeyDown={ev => {
          ev.stopPropagation()
        }}
        placeholder='Search assets...'
        type='text'
        value={searchTerm}
      />
      <FilterOptions>
        <FilterOption onClick={() => setFilterOption('all')}>
          <FilterRadio checked={filterOption === 'all'} />
          <FilterLabel>All Assets</FilterLabel>
        </FilterOption>
        <FilterOption onClick={() => setFilterOption('from world')}>
          <FilterRadio checked={filterOption === 'from world'} />
          <FilterLabel>From World</FilterLabel>
        </FilterOption>
        <FilterOption onClick={() => setFilterOption('from user')}>
          <FilterRadio checked={filterOption === 'from user'} />
          <FilterLabel>From User</FilterLabel>
        </FilterOption>
      </FilterOptions>
      <AssetList>
        {filteredAssets.map(asset => (
          <AssetItem
            draggable
            key={asset.id}
            onDragStart={event => {
              event.dataTransfer.setData('text/plain', asset.imageURL)
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {' '}
              <ImagePreview alt={asset.name} crossOrigin='anonymous' src={asset.imageURL} />
              {editingId === asset.id ? (
                <input
                  autoFocus
                  onBlur={async () => handleEditName()}
                  onChange={ev => handleNameChange(ev.target.value)}
                  onKeyDown={ev => {
                    if (ev.key === 'Enter') {
                      void handleEditName()
                    }

                    ev.stopPropagation()
                  }}
                  type='text'
                  value={newName}
                />
              ) : (
                <div
                  onDoubleClick={() => {
                    setEditingId(asset.id)
                    setNewName(asset.name.replace('.png', ''))
                  }}
                >
                  {asset.name.length > 16 ? `${asset.name.slice(0, 16)}...` : asset.name}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: '5px' }}>
              <CopyButton onClick={() => handleCopyUrl(asset.id, asset.imageURL)}>
                {copiedAssetId === asset.id ? (
                  <svg
                    fill='none'
                    height='16'
                    stroke='currentColor'
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth='2'
                    viewBox='0 0 24 24'
                    width='16'
                    xmlns='http://www.w3.org/2000/svg'
                  >
                    <path d='M20 6L9 17l-5-5' />
                  </svg>
                ) : (
                  <svg
                    fill='none'
                    height='16'
                    stroke='currentColor'
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth='2'
                    viewBox='0 0 24 24'
                    width='16'
                    xmlns='http://www.w3.org/2000/svg'
                  >
                    <rect height='13' rx='2' ry='2' width='13' x='9' y='9' />
                    <path d='M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1' />
                  </svg>
                )}
              </CopyButton>
              <DeleteButton onClick={async () => confirmDeleteImage(asset.name, asset.id)}>
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
            </div>
          </AssetItem>
        ))}
      </AssetList>
    </div>
  )
}
