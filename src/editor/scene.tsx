import type { SpawnableEntity } from '@dreamlab.gg/core'
import {
  useGame,
  useNetwork,
  usePlayer,
  useSpawnableEntities,
} from '@dreamlab.gg/ui/react'
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'https://esm.sh/v136/react@18.2.0'
import type { FC } from 'https://esm.sh/v136/react@18.2.0'
import { styled } from 'https://esm.sh/v136/styled-components@6.1.1'
import { Button, Container } from './components'
import type { Selector } from './select'

interface ListContainerProps {
  isCollapsed: boolean
}

const ListContainer = styled(Container)<ListContainerProps>`
  top: 5rem;
  left: var(--margin);
  bottom: var(--margin);
  display: flex;
  flex-direction: column;
  opacity: 0.7;
  transform: ${props =>
    props.isCollapsed ? 'translateX(-92%)' : 'translateX(0)'};
  transition:
    transform 0.3s ease,
    visibility 0.3s ease;

  &:hover {
    opacity: 1;
  }
`

const EntityList = styled.div`
  flex-grow: 1;
  margin-bottom: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  overflow-y: overlay;
  padding: 0.5rem 0;
`

export const CollapseButton = styled.button`
  position: absolute;
  top: 0.3rem;
  background-color: transparent;
  color: #4a4a4a;
  border: none;
  cursor: pointer;
  padding: 0.5rem;
  border-radius: 0.3rem;
  font-size: 1.2rem;
  transition:
    background-color 0.3s,
    color 0.3s;

  &:hover {
    background-color: rgba(0, 0, 0, 0.1);
    color: #2c2c2c;
  }

  &:focus {
    outline: none;
  }
`

export const SceneList: FC<{ readonly selector: Selector }> = ({
  selector,
}) => {
  const etys = useSpawnableEntities()
  const entities = [...etys].sort((a, b) =>
    a.definition.entity.localeCompare(b.definition.entity),
  )
  const [isCollapsed, setIsCollapsed] = useState(false)

  const toggleCollapse = useCallback(() => {
    setIsCollapsed(prev => !prev)
  }, [])

  const [selectedEntityUid, setSelectedEntityUid] = useState<
    string | undefined
  >(undefined)

  useEffect(() => {
    const onSelect = (uid: string | undefined) => {
      setSelectedEntityUid(uid)
    }

    selector.events().addListener('onSelect', onSelect)

    return () => {
      selector.events().removeListener('onSelect', onSelect)
    }
  }, [])

  const onSave = useCallback(() => {
    // Filter out entities tagged as "do not save"
    const toSave = entities
      .filter(entity => !entity.tags.includes('editor/doNotSave'))
      .map(entity => entity.definition)

    const json = JSON.stringify(toSave, null, 2)
    const template = `
import type { LooseSpawnableDefinition } from '@dreamlab.gg/core'

export const level: LooseSpawnableDefinition[] = ${json}
`.trim()

    console.log(template)
    // TODO: Do something with level.json
  }, [entities])

  return (
    <>
      <ListContainer isCollapsed={isCollapsed}>
        <CollapseButton
          onClick={toggleCollapse}
          style={{
            right: '0.3rem',
          }}
        >
          {isCollapsed ? '✚' : '─'}
        </CollapseButton>
        {!isCollapsed && (
          <>
            <h1>Object List</h1>
            <EntityList>
              {entities.map(entity => (
                // eslint-disable-next-line @typescript-eslint/no-use-before-define
                <EntityDisplay
                  key={entity.uid}
                  entity={entity}
                  selector={selector}
                  isSelected={entity.uid === selectedEntityUid}
                />
              ))}
            </EntityList>
            <Button type='button' onClick={onSave}>
              Save
            </Button>
          </>
        )}
      </ListContainer>
    </>
  )
}

const EntityButtons = styled.div`
  display: flex;
  gap: 0.25rem;
`

interface SelectButtonProps {
  isSelected: boolean
}

const SelectButton = styled(Button)<SelectButtonProps>`
  flex-grow: 1;
  background-color: ${props =>
    props.isSelected ? 'rgb(236 72 153)' : 'rgb(99 102 241)'};
  color: white;
  transition: background-color 0.3s ease;

  &:hover {
    background-color: ${props =>
      props.isSelected ? 'rgb(249 168 212)' : 'rgb(129 140 248)'};
  }
`

const IconButton = styled(Button)`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.5rem;

  & svg {
    width: 1.5rem;
    height: 1.5rem;
  }
  &:hover {
    transform: translateY(-2px);
  }
`

const DeleteButton = styled(IconButton)`
  background-color: #ef4444;

  &:hover {
    background-color: #b91c1c;
    transform: translateY(-2px);
  }
`

const LockButton = styled(IconButton)`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.5rem;

  &.locked {
    background-color: #ef4444;
    &:hover {
      background-color: #b91c1c;
    }
  }

  & svg {
    width: 1.5rem;
    height: 1.5rem;
    transition: transform 0.3s ease;
  }

  &:hover {
    transform: translateY(-2px);
  }
`

const EntityDisplay: FC<{
  readonly selector: Selector
  entity: SpawnableEntity
  isSelected: boolean
}> = ({ selector, entity, isSelected }) => {
  const game = useGame()
  const network = useNetwork()
  const player = usePlayer()
  const entityRef = useRef<HTMLDivElement>(null)
  const [isLocked, setIsLocked] = useState(entity.tags.includes('editorLocked'))

  const onFocus = useCallback(() => {
    if (!player) return
    player.teleport(entity.transform.position, true)
  }, [player])

  const onSelect = useCallback(() => {
    if (!entity.definition.tags?.includes('editorLocked')) {
      selector.select(entity)
    }
  }, [player])

  const onDelete = useCallback(async () => {
    const id = entity.uid
    await game.destroy(entity)

    await network?.sendEntityDestroy(id)
  }, [network, entity])

  const onLockToggle = useCallback(() => {
    const newTags = isLocked
      ? entity.tags.filter(tag => tag !== 'editorLocked')
      : [...entity.tags, 'editorLocked']

    setIsLocked(!isLocked)
    entity.definition.tags = newTags
  }, [entity, isLocked])

  useEffect(() => {
    if (isSelected && entityRef.current) {
      entityRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [isSelected])

  return (
    <EntityButtons id={entity.uid} ref={entityRef}>
      <SelectButton isSelected={isSelected} onClick={onSelect}>
        {entity.definition.entity}
      </SelectButton>

      <IconButton type='button' title='Focus' onClick={onFocus}>
        <svg
          xmlns='http://www.w3.org/2000/svg'
          viewBox='0 0 24 24'
          fill='currentColor'
          className='w-6 h-6'
        >
          <path d='M6 3a3 3 0 00-3 3v1.5a.75.75 0 001.5 0V6A1.5 1.5 0 016 4.5h1.5a.75.75 0 000-1.5H6zM16.5 3a.75.75 0 000 1.5H18A1.5 1.5 0 0119.5 6v1.5a.75.75 0 001.5 0V6a3 3 0 00-3-3h-1.5zM12 8.25a3.75 3.75 0 100 7.5 3.75 3.75 0 000-7.5zM4.5 16.5a.75.75 0 00-1.5 0V18a3 3 0 003 3h1.5a.75.75 0 000-1.5H6A1.5 1.5 0 014.5 18v-1.5zM21 16.5a.75.75 0 00-1.5 0V18a1.5 1.5 0 01-1.5 1.5h-1.5a.75.75 0 000 1.5H18a3 3 0 003-3v-1.5z' />
        </svg>
      </IconButton>

      <LockButton
        type='button'
        title='Lock/Unlock'
        onClick={onLockToggle}
        className={isLocked ? 'locked' : 'unlocked'}
      >
        {isLocked ? (
          <svg
            xmlns='http://www.w3.org/2000/svg'
            fill='currentColor'
            viewBox='0 0 448 512'
          >
            <path d='M144 144v48H304V144c0-44.2-35.8-80-80-80s-80 35.8-80 80zM80 192V144C80 64.5 144.5 0 224 0s144 64.5 144 144v48h16c35.3 0 64 28.7 64 64V448c0 35.3-28.7 64-64 64H64c-35.3 0-64-28.7-64-64V256c0-35.3 28.7-64 64-64H80z' />
          </svg>
        ) : (
          <svg
            xmlns='http://www.w3.org/2000/svg'
            fill='currentColor'
            viewBox='0 0 576 512'
          >
            <path d='M352 144c0-44.2 35.8-80 80-80s80 35.8 80 80v48c0 17.7 14.3 32 32 32s32-14.3 32-32V144C576 64.5 511.5 0 432 0S288 64.5 288 144v48H64c-35.3 0-64 28.7-64 64V448c0 35.3 28.7 64 64 64H384c35.3 0 64-28.7 64-64V256c0-35.3-28.7-64-64-64H352V144z' />
          </svg>
        )}
      </LockButton>

      <DeleteButton type='button' title='Delete' onClick={onDelete}>
        <svg
          xmlns='http://www.w3.org/2000/svg'
          viewBox='0 0 24 24'
          fill='currentColor'
          className='w-6 h-6'
        >
          <path
            fillRule='evenodd'
            d='M16.5 4.478v.227a48.816 48.816 0 013.878.512.75.75 0 11-.256 1.478l-.209-.035-1.005 13.07a3 3 0 01-2.991 2.77H8.084a3 3 0 01-2.991-2.77L4.087 6.66l-.209.035a.75.75 0 01-.256-1.478A48.567 48.567 0 017.5 4.705v-.227c0-1.564 1.213-2.9 2.816-2.951a52.662 52.662 0 013.369 0c1.603.051 2.815 1.387 2.815 2.951zm-6.136-1.452a51.196 51.196 0 013.273 0C14.39 3.05 15 3.684 15 4.478v.113a49.488 49.488 0 00-6 0v-.113c0-.794.609-1.428 1.364-1.452zm-.355 5.945a.75.75 0 10-1.5.058l.347 9a.75.75 0 101.499-.058l-.346-9zm5.48.058a.75.75 0 10-1.498-.058l-.347 9a.75.75 0 001.5.058l.345-9z'
            clipRule='evenodd'
          />
        </svg>
      </DeleteButton>
    </EntityButtons>
  )
}
