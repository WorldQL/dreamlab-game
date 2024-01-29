import axios from 'axios'
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'https://esm.sh/v136/react@18.2.0'
import type {
  ChangeEventHandler,
  DragEventHandler,
} from 'https://esm.sh/v136/react@18.2.0'
import { styled } from 'https://esm.sh/v136/styled-components@6.1.6'
import { DeleteButton } from '../ui/buttons'

const AssetUploader = styled.div`
  border: 2px dashed rgb(99 102 241);
  padding: 36px;
  text-align: center;
  cursor: pointer;
  margin-top: 10px;
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
  const [assets, setAssets] = useState<ImageData[]>([])
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

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

    imageAssets.reverse()

    setAssets(imageAssets)

    // after we get the list of URLs from the user's library, we also load the images of everything that's currently in the game
    // then we remove duplicates by matching on URL
  }, [jwt, nextAPIBaseURL])

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
        setAssets(prev => [
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
        Drag and drop files or click here
        <input
          onChange={handleFileChange}
          ref={fileInputRef}
          style={{ display: 'none' }}
          type='file'
        />
      </AssetUploader>
      <AssetList>
        {assets.map(asset => (
          <AssetItem
            draggable
            key={asset.id}
            onDragStart={event =>
              event.dataTransfer.setData('text/plain', asset.imageURL)
            }
          >
            <ImagePreview
              alt={asset.name}
              crossOrigin='anonymous'
              src={asset.imageURL}
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
              onClick={async () => confirmDeleteImage(asset.name, asset.id)}
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
    </div>
  )
}
