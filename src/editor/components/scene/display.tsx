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
import { LOCKED_TAG } from '../../editor'
import type { Selector } from '../../entities/select'
import type { HistoryData } from '../history'
import { DeleteButton, LockButton } from '../ui/buttons'

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
  padding: 6px;
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

const SelectButton = styled.button<{ isSelected: boolean }>`
  display: flex;
  align-items: center;
  width: 100%;
  appearance: none;
  border: 2px solid transparent;
  font-family: 'Inter', sans-serif;
  cursor: pointer;
  padding: 0.8rem 1rem;
  border-radius: 0.4rem;
  font-weight: 500;
  letter-spacing: 0.025em;
  background-color: white;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  background-color: ${props =>
    props.isSelected ? 'rgb(99, 102, 241)' : 'white'};
  color: ${props => (props.isSelected ? 'white' : '#333')};
  padding: 6px;

  &:hover {
    background-color: ${props =>
      props.isSelected ? 'rgb(79, 70, 229)' : 'white'};
    border: ${props =>
      props.isSelected
        ? '2px solid transparent'
        : '2px solid rgb(79, 70, 229)'};
  }
`

interface DisplayProps {
  readonly selector: Selector
  readonly entity: SpawnableEntity
  isSelected: boolean
  history: HistoryData
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
    Boolean(entity.definition.tags?.includes(LOCKED_TAG)),
  )

  const [isEditingLabel, setIsEditingLabel] = useState(false)
  const [editedLabel, setEditedLabel] = useState(
    entity.definition.label ?? entity.definition.entity,
  )

  const [tags, setTags] = useState(entity.definition.tags)

  useEffect(() => {
    if (tags.includes(LOCKED_TAG)) {
      setIsLocked(true)
    } else {
      setIsLocked(false)
    }
  }, [tags])

  const onSelect = useCallback(() => {
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
    selector.deselect()
    history.record({ type: 'delete', definition: entity.definition })
    await game.destroy(entity)
    await network?.sendEntityDestroy(id)
  }, [entity, game, history, network, selector])

  const onLockToggle = useCallback(() => {
    const newTags = isLocked
      ? entity.definition.tags.filter(tag => tag !== LOCKED_TAG)
      : [...entity.definition.tags, LOCKED_TAG]

    history.record({
      type: 'tags',
      definition: JSON.parse(JSON.stringify(entity)),
    })
    entity.definition.tags = newTags
    setTags(entity.definition.tags)
    selector.events.emit('onTagsUpdate', entity.uid, newTags)
  }, [entity, history, isLocked, selector.events])

  const handleLabelChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setEditedLabel(event.target.value)
    },
    [],
  )

  const handleDoubleClick = useCallback(() => {
    if (isSelected) {
      setIsEditingLabel(true)
    }
  }, [isSelected])

  const toggleEdit = useCallback(() => {
    if (isEditingLabel) {
      entity.definition.label = editedLabel
      setIsEditingLabel(false)
    }
  }, [isEditingLabel, editedLabel, entity.definition])

  const handleKeyPress = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      event.stopPropagation()
      if (event.key === 'Enter') {
        toggleEdit()
      }
    },
    [toggleEdit],
  )

  useEffect(() => {
    if (isSelected && entityRef.current) {
      setTimeout(
        () =>
          entityRef.current?.scrollIntoView({
            behavior: 'smooth',
            block: 'nearest',
          }),
        1,
      )
    }
  }, [isSelected])

  useEffect(() => {
    const handleTagsUpdate = (entityId: string, tags: string[]) => {
      if (entityId !== entity.uid) return
      setTags(tags)
      setIsLocked(tags.includes(LOCKED_TAG))
    }

    selector.events.addListener('onTagsUpdate', handleTagsUpdate)

    return () => {
      selector.events.removeListener('onTagsUpdate', handleTagsUpdate)
    }
  }, [entity.definition, entity.uid, selector.events])

  return (
    <EntityButtons id={entity.uid} ref={entityRef}>
      <SelectButton
        className='select-button'
        isSelected={isSelected}
        onClick={onSelect}
      >
        {isEditingLabel ? (
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
