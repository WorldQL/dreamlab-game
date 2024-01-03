import type { SpawnableEntity } from '@dreamlab.gg/core'
import { useGame, useNetwork, usePlayer } from '@dreamlab.gg/ui/react'
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'https://esm.sh/v136/react@18.2.0'
import type { FC } from 'https://esm.sh/v136/react@18.2.0'
import { styled } from 'https://esm.sh/v136/styled-components@6.1.6'
import type { Action } from '../../editor'
import type { Selector } from '../../entities/select'
import { Button, DeleteButton, LockButton } from '../ui/buttons'

const EntityButtons = styled.div`
  display: flex;
  align-items: top;
  gap: 0.25rem;
  position: relative;
`

const ControlButtons = styled.div<{ showLock: boolean }>`
  display: flex;
  align-items: flex-start;
  gap: 4px;
  position: absolute;
  top: 0;
  right: 0;
  padding: 4px;
  opacity: 0;
  visibility: hidden;
  transition:
    opacity 0.3s ease,
    visibility 0s linear 0.3s;

  ${EntityButtons}:hover &,
  &:hover {
    opacity: 1;
    visibility: visible;
    transition:
      opacity 0.3s ease,
      visibility 0s;
  }

  ${props =>
    props.showLock &&
    `
    opacity: 1;
    visibility: visible;
    transition: none;
  `}
`

const InfoDetails = styled.div<{ isSelected: boolean }>`
  display: ${props => (props.isSelected ? 'block' : 'none')};
  background-color: #f3f3f3;
  padding: 8px;
  border-radius: 4px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  font-size: 0.8rem;
  color: #333;
  margin-top: 4px;
  text-align: left;
  width: 94%;
  & > p {
    margin: 0;
    margin-bottom: 4px;
  }
`

const SelectButton = styled(Button)<{ isSelected: boolean }>`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  flex-grow: 1;
  background-color: ${props =>
    props.isSelected ? 'rgb(236, 72, 153)' : 'rgb(99, 102, 241)'};
  color: white;
  transition: background-color 0.3s ease;
  position: relative;
  padding: 8px;

  &:hover {
    background-color: ${props =>
      props.isSelected ? 'rgb(244 114 182)' : 'rgb(129, 140, 248)'};
  }
`

interface DisplayProps {
  readonly selector: Selector
  readonly entity: SpawnableEntity
  isSelected: boolean
  history: {
    record(action: Action): void
    undo(): void
    getActions(): Action[]
  }
}

export const EntityDisplay: FC<DisplayProps> = ({
  selector,
  entity,
  isSelected,
  history,
}) => {
  const game = useGame()
  const network = useNetwork()
  const player = usePlayer()
  const entityRef = useRef<HTMLDivElement>(null)
  const [isLocked, setIsLocked] = useState(
    Boolean(entity.definition.tags?.includes('editorLocked')),
  )

  const [isEditing, setIsEditing] = useState(false)
  const [editedLabel, setEditedLabel] = useState(entity.definition.entity)
  const [editableArgs, setEditableArgs] = useState(entity.args)
  const inputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({})

  const handleArgChange = (key: string, value: unknown) => {
    setEditableArgs(prevArgs => ({ ...prevArgs, [key]: value }))
  }

  const handleArgSave = useCallback(() => {
    // doesnt save on reload but will save locally
    entity.definition.args = editableArgs
    selector.events.emit('onArgsUpdate', entity.uid, entity.definition.args)
  }, [editableArgs, entity.definition, entity.uid, selector.events])

  const onSelect = useCallback(() => {
    const locked = entity.tags?.includes('editorLocked')
    if (locked) return

    selector.select(entity)
    if (player) player.teleport(entity.transform.position, true)
  }, [selector, entity, player])

  const onDelete = useCallback(async () => {
    if (!entity) return

    // eslint-disable-next-line no-alert
    const isConfirmed = window.confirm(
      `Are you sure you want to delete "${entity.definition.entity}"?`,
    )
    if (!isConfirmed) return

    const id = entity.uid
    history.record({ type: 'delete', definition: entity.definition })
    await game.destroy(entity)
    await network?.sendEntityDestroy(id)
  }, [entity, game, history, network])

  const onLockToggle = useCallback(() => {
    const newTags = isLocked
      ? entity.tags.filter(tag => tag !== 'editorLocked')
      : [...entity.tags, 'editorLocked']

    setIsLocked(!isLocked)
    entity.definition.tags = newTags
  }, [entity, isLocked])

  const handleLabelChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setEditedLabel(event.target.value)
    },
    [],
  )

  const handleDoubleClick = useCallback(() => {
    if (isSelected) {
      setIsEditing(true)
    }
  }, [isSelected])

  const toggleEdit = useCallback(() => {
    if (isEditing) {
      entity.definition.label = editedLabel
      setIsEditing(false)
    }
  }, [isEditing, editedLabel, entity.definition])

  const handleKeyPress = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Enter') {
        toggleEdit()
      }
    },
    [toggleEdit],
  )

  useEffect(() => {
    if (isSelected && entityRef.current) {
      entityRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [isSelected])

  return (
    <EntityButtons id={entity.uid} ref={entityRef}>
      <SelectButton
        className='select-button'
        isSelected={isSelected}
        onClick={onSelect}
      >
        {isEditing ? (
          <input
            autoFocus
            onBlur={toggleEdit}
            onChange={handleLabelChange}
            onKeyDown={handleKeyPress}
            type='text'
            value={editedLabel}
          />
        ) : (
          <span onDoubleClick={handleDoubleClick}>
            {entity.label
              ? entity.label.length > 30
                ? entity.label.slice(0, 30) + '...'
                : entity.label
              : entity.definition.entity.length > 30
              ? entity.definition.entity.slice(0, 30) + '...'
              : entity.definition.entity}
          </span>
        )}
        <InfoDetails isSelected={isSelected}>
          <p>
            Entity:{' '}
            {entity.definition.entity.length > 30
              ? entity.definition.entity.slice(0, 30) + '...'
              : entity.definition.entity}
          </p>
          <p>Z-Index: {entity.transform.zIndex}</p>
          <div>
            <div>
              {Object.entries(editableArgs).map(([key, value]) => (
                <div key={key} style={{ marginBottom: '0.5em' }}>
                  <p style={{ fontWeight: 'bold', margin: '0' }}>{key}:</p>
                  <input
                    onBlur={handleArgSave}
                    onChange={ev => handleArgChange(key, ev.target.value)}
                    onKeyDown={ev => {
                      if (ev.key === 'Enter') inputRefs.current[key]?.blur()
                    }}
                    ref={el => (inputRefs.current[key] = el)}
                    style={{
                      width: '80%',
                      padding: '0.5em',
                      marginTop: '0.25em',
                      border: '1px solid #ccc',
                      borderRadius: '4px',
                    }}
                    type='text'
                    value={value}
                  />
                </div>
              ))}
            </div>
          </div>
        </InfoDetails>
      </SelectButton>
      <ControlButtons showLock={isLocked}>
        <DeleteButton
          onClick={onDelete}
          style={{
            opacity: isLocked ? 0 : undefined,
            visibility: isLocked ? 'hidden' : undefined,
          }}
          title='Delete'
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
        <LockButton
          isLocked={isLocked}
          onClick={onLockToggle}
          style={{
            opacity: isLocked ? 1 : undefined,
            visibility: isLocked ? 'visible' : undefined,
          }}
          title='Lock/Unlock'
        >
          {isLocked ? (
            <svg
              fill='currentColor'
              viewBox='0 0 448 512'
              xmlns='http://www.w3.org/2000/svg'
            >
              <path d='M144 144v48H304V144c0-44.2-35.8-80-80-80s-80 35.8-80 80zM80 192V144C80 64.5 144.5 0 224 0s144 64.5 144 144v48h16c35.3 0 64 28.7 64 64V448c0 35.3-28.7 64-64 64H64c-35.3 0-64-28.7-64-64V256c0-35.3 28.7-64 64-64H80z' />
            </svg>
          ) : (
            <svg
              fill='currentColor'
              viewBox='0 0 576 512'
              xmlns='http://www.w3.org/2000/svg'
            >
              <path d='M352 144c0-44.2 35.8-80 80-80s80 35.8 80 80v48c0 17.7 14.3 32 32 32s32-14.3 32-32V144C576 64.5 511.5 0 432 0S288 64.5 288 144v48H64c-35.3 0-64 28.7-64 64V448c0 35.3 28.7 64 64 64H384c35.3 0 64-28.7 64-64V256c0-35.3-28.7-64-64-64H352V144z' />
            </svg>
          )}
        </LockButton>
      </ControlButtons>
    </EntityButtons>
  )
}
