import type { SpawnableEntity } from '@dreamlab.gg/core'
import type { Transform } from '@dreamlab.gg/core/math'
import { getProperty, setProperty } from '@dreamlab.gg/core/utils'
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
import { renderInputForZodSchema } from './types'

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
  padding: 4px;
  margin-top: 4px;
  border-radius: 4px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
  font-size: 0.75rem;
  color: #333;
  text-align: left;
  width: 94%;

  & > p {
    margin: 2px 0;
  }

  input {
    width: 80%;
    padding: 4px;
    margin: 1px 0;
    border: 1px solid #c3dafe;
    border-radius: 2px;
    background-color: #eef2ff;
    color: #1a202c;

    &:focus {
      border-color: #4c51bf;
    }

    &::placeholder {
      color: #a0aec0;
    }
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
  padding: 6px;

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

  const [isEditingLabel, setIsEditingLabel] = useState(false)
  const [editedLabel, setEditedLabel] = useState(
    entity.definition.label ?? entity.definition.entity,
  )
  const [editableArgs, setEditableArgs] = useState(entity.args)
  const [entityTransform, setEntityTransform] = useState(entity.transform)
  const [newTag, setNewTag] = useState('')
  const [tags, setTags] = useState(entity.definition.tags)
  const argsInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({})

  const handleAddTag = () => {
    if (newTag) {
      entity.definition.tags?.push(newTag)
      setTags(entity.definition.tags ?? [])
      setNewTag('')
    }
  }

  const handleDeleteTag = (tagToDelete: string) => {
    const updatedTags = tags.filter(tag => tag !== tagToDelete)
    setTags(updatedTags)
    entity.definition.tags = updatedTags
  }

  const handleArgChange = (key: string, value: unknown) => {
    setEditableArgs(prevArgs => {
      const updatedArgs = { ...prevArgs }
      setProperty(updatedArgs, key, value)

      return updatedArgs
    })
  }

  const handlePositionChange = (axis: 'x' | 'y', value: number) => {
    setEntityTransform(prevTransform => ({
      ...prevTransform,
      position: {
        ...prevTransform.position,
        [axis]: value,
      },
    }))
  }

  const handleOtherTransformChange = (
    property: 'rotation' | 'zIndex',
    value: number,
  ) => {
    setEntityTransform(prevTransform => ({
      ...prevTransform,
      [property]: value,
    }))
  }

  const handleTransformSave = useCallback(() => {
    const newTransform = {
      ...entityTransform,
      position: {
        x: Number.isNaN(entityTransform.position.x)
          ? 0
          : entityTransform.position.x,
        y: Number.isNaN(entityTransform.position.y)
          ? 0
          : entityTransform.position.y,
      },
      rotation: Number.isNaN(entityTransform.rotation)
        ? 0
        : entityTransform.rotation,
      zIndex: Number.isNaN(entityTransform.zIndex) ? 0 : entityTransform.zIndex,
    }

    setEntityTransform(prevTransform => ({
      ...prevTransform,
      ...newTransform,
    }))

    entity.definition.transform = newTransform
    selector.events.emit('onTransformManualUpdate', entity.uid, newTransform)
  }, [entity.definition, entity.uid, entityTransform, selector.events])

  const handleArgSave = useCallback(
    (key: string, value?: { _v: unknown }) => {
      const val =
        value !== undefined
          ? value._v
          : (getProperty(editableArgs, key) as unknown)

      selector.events.emit('onArgsManualUpdate', entity.uid, key, val)
    },
    [editableArgs, entity.uid, selector.events],
  )

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
    history.record({ type: 'delete', definition: entity.definition })
    await game.destroy(entity)
    await network?.sendEntityDestroy(id)
  }, [entity, game, history, network])

  const onLockToggle = useCallback(() => {
    const newTags = isLocked
      ? entity.definition.tags.filter(tag => tag !== 'editorLocked')
      : [...entity.definition.tags, 'editorLocked']

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
      )
    }
  }, [isSelected])

  useEffect(() => {
    const handleArgsUpdate = (entityId: string, newArgs: unknown) => {
      if (entityId === entity.uid) {
        setEditableArgs(prevArgs => ({
          ...prevArgs,
          ...(newArgs as Record<string, unknown>),
        }))
      }
    }

    const handleTransformUpdate = (entityId: string, transform: Transform) => {
      if (entityId === entity.uid) {
        setEntityTransform(prevTransform => ({
          ...prevTransform,
          ...transform,
        }))
      }
    }

    selector.events.addListener('onArgsUpdate', handleArgsUpdate)
    selector.events.addListener('onTransformUpdate', handleTransformUpdate)

    return () => {
      selector.events.removeListener('onArgsUpdate', handleArgsUpdate)
      selector.events.removeListener('onTransformUpdate', handleTransformUpdate)
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
        <InfoDetails isSelected={isSelected}>
          <p>
            Entity:{' '}
            {entity.definition.entity.length > 30
              ? entity.definition.entity.slice(0, 30) + '...'
              : entity.definition.entity}
          </p>
          <div style={{ fontWeight: 'bold', margin: '0' }}>
            <div>
              <div>x:</div>
              <input
                onBlur={handleTransformSave}
                onChange={ev =>
                  handlePositionChange('x', ev.target.valueAsNumber)
                }
                onKeyDown={ev => {
                  if (ev.key === 'Enter') {
                    ev.currentTarget.blur()
                    return
                  }

                  ev.stopPropagation()
                }}
                type='number'
                value={Math.round(entityTransform.position.x)}
              />
            </div>
            <div>
              <div>y:</div>
              <input
                onBlur={handleTransformSave}
                onChange={ev =>
                  handlePositionChange('y', ev.target.valueAsNumber)
                }
                onKeyDown={ev => {
                  if (ev.key === 'Enter') {
                    ev.currentTarget.blur()
                    return
                  }

                  ev.stopPropagation()
                }}
                type='number'
                value={Math.round(entityTransform.position.y)}
              />
            </div>
          </div>
          <div style={{ fontWeight: 'bold', margin: '0' }}>
            <div>
              <div>angle:</div>
              <input
                onBlur={handleTransformSave}
                onChange={ev =>
                  handleOtherTransformChange(
                    'rotation',
                    ev.target.valueAsNumber,
                  )
                }
                onKeyDown={ev => {
                  if (ev.key === 'Enter') {
                    ev.currentTarget.blur()
                    return
                  }

                  ev.stopPropagation()
                }}
                type='number'
                value={Math.round(entityTransform.rotation)}
              />
            </div>
          </div>
          <div style={{ fontWeight: 'bold', margin: '0' }}>
            <div>
              <div>Z-Index:</div>
              <input
                onBlur={handleTransformSave}
                onChange={ev =>
                  handleOtherTransformChange('zIndex', ev.target.valueAsNumber)
                }
                onKeyDown={ev => {
                  if (ev.key === 'Enter') {
                    ev.currentTarget.blur()
                    return
                  }

                  ev.stopPropagation()
                }}
                type='number'
                value={entityTransform.zIndex}
              />
            </div>
          </div>

          <div>
            <div>
              {Object.entries(editableArgs).map(([key, value]) => {
                const schemaType = entity.argsSchema.shape[key]

                return (
                  <div key={key}>
                    {renderInputForZodSchema(
                      key,
                      value,
                      schemaType,
                      handleArgChange,
                      handleArgSave,
                      argsInputRefs,
                      0,
                    )}
                  </div>
                )
              })}
            </div>
          </div>
          <div>
            <p>Tags:</p>
            <div
              style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}
            >
              {tags.map(tag => (
                <div
                  key={tag}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    fontSize: '0.75rem',
                  }}
                >
                  <button
                    onClick={() => handleDeleteTag(tag)}
                    style={{
                      marginRight: '4px',
                      border: 'none',
                      padding: 0,
                      cursor: 'pointer',
                    }}
                    type='button'
                  >
                    <svg
                      style={{ width: '16px', height: '16px', fill: 'red' }}
                      viewBox='0 0 24 24'
                      xmlns='http://www.w3.org/2000/svg'
                    >
                      <path
                        clipRule='evenodd'
                        d='M16.5 4.478v.227a48.816 48.816 0 013.878.512.75.75 0 11-.256 1.478l-.209-.035-1.005 13.07a3 3 0 01-2.991 2.77H8.084a3 3 0 01-2.991-2.77L4.087 6.66l-.209.035a.75.75 0 01-.256-1.478A48.567 48.567 0 017.5 4.705v-.227c0-1.564 1.213-2.9 2.816-2.951a52.662 52.662 0 013.369 0c1.603.051 2.815 1.387 2.815 2.951zm-6.136-1.452a51.196 51.196 0 013.273 0C14.39 3.05 15 3.684 15 4.478v.113a49.488 49.488 0 00-6 0v-.113c0-.794.609-1.428 1.364-1.452zm-.355 5.945a.75.75 0 10-1.5.058l.347 9a.75.75 0 101.499-.058l-.346-9zm5.48.058 a.75.75 0 10-1.498-.058l-.347 9 a.75.75 0 001.5.058l.345-9z'
                        fillRule='evenodd'
                      />
                    </svg>
                  </button>
                  {tag.length > 20 ? `${tag.slice(0, 20)}...` : tag}
                </div>
              ))}

              <div style={{ display: 'flex', alignItems: 'center' }}>
                <input
                  onChange={ev => setNewTag(ev.target.value)}
                  onKeyDown={ev => {
                    if (ev.key === 'Enter' && newTag !== '') {
                      handleAddTag()
                      return
                    }

                    ev.stopPropagation()
                  }}
                  placeholder='New tag'
                  style={{ marginRight: '4px', fontSize: '0.75rem' }}
                  value={newTag}
                />
                <button
                  onClick={handleAddTag}
                  style={{ fontSize: '0.75rem' }}
                  type='button'
                >
                  +
                </button>
              </div>
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
