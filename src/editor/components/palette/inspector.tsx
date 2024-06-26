import type { SpawnableEntity } from '@dreamlab.gg/core'
import type { EventHandler } from '@dreamlab.gg/core/dist/events'
import type { Transform } from '@dreamlab.gg/core/math'
import { clone, getProperty, setProperty } from '@dreamlab.gg/core/utils'
import { useCommonEventListener, useForceUpdate, useTransform } from '@dreamlab.gg/ui/dist/react'
import { styled } from 'https://esm.sh/styled-components@6.1.8?pin=v135'
import { useDebounceCallback } from 'https://esm.sh/usehooks-ts@2.12.1?pin=v135'
import { useCallback, useRef, useState } from 'react'
import type { FC } from 'react'
import type { History } from '../../entities/history'
// import type { Selector } from '../../entities/select'
import { renderInputForZodSchema } from '../scene/types'

const EntityButtons = styled.div`
  display: flex;
  align-items: top;
  gap: 0.25rem;
  position: relative;
`

const InfoDetails = styled.div<{ isSelected: boolean }>`
  display: ${props => (props.isSelected ? 'block' : 'none')};
  border-radius: 6px;
  font-size: 0.9rem;
  color: #4a4a4a;
  width: 94%;

  p {
    margin-bottom: 8px;
  }

  .detail-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;

    span {
      font-weight: 600;
      margin-right: 10px;
      white-space: nowrap;
      width: 80px;
    }

    input {
      width: calc(100% - 60px);
      padding: 4px;
      border: 1px solid #ccc;
      border-radius: 4px;
      background-color: white;
      box-sizing: border-box;
      height: 30px;
    }
  }
  .detail-col {
    display: flex;
    flex-direction: column;
    margin-bottom: 8px;

    span {
      font-weight: 600;
      white-space: nowrap;
      margin-bottom: 4px;
    }

    input {
      padding: 4px;
      border: 1px solid #ccc;
      border-radius: 4px;
      background-color: white;
      box-sizing: border-box;
      height: 30px;
    }
  }
`
const InspectorStyle = styled.div`
  display: flex;
  flex-direction: column;
  background-color: #f9f9f9;
  border-radius: 6px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  padding: 16px;
  color: #333;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  margin: 8px 0;

  h2 {
    color: #4a4a4a;
    margin-bottom: 12px;
  }

  .form-field {
    margin-bottom: 12px;
  }

  input,
  .tag-input {
    width: 100%;
    height: 75%;
    padding: 10px;
    border: 1px solid #ccc;
    border-radius: 4px;
    background-color: white;
    box-sizing: border-box;
  }

  .tag-input {
    flex-grow: 1;
  }

  .tags-container {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 12px;
  }

  .tag {
    background-color: #e0e0e0;
    border-radius: 4px;
    padding: 6px 10px;
    font-size: 0.85rem;
    color: #333;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .remove-tag {
    cursor: pointer;
    color: #ff6b6b;
  }

  .add-tag {
    display: flex;
    align-items: center;
    gap: 8px;
  }
`

interface InspectorProps {
  // readonly selector: Selector
  readonly entity: SpawnableEntity
  readonly history: History
}

const roundValue = (
  value: string,
  decimalPlaces: number,
): [str: string, valid: boolean, value: number] => {
  const numValue = Number.parseFloat(value)
  if (Number.isNaN(numValue)) {
    return [value, false, Number.NaN]
  }

  const factor = 10 ** decimalPlaces
  const rounded = (Math.round(numValue * factor) / factor).toString()
  return [rounded, true, numValue]
}

export const Inspector: FC<InspectorProps> = ({ entity, history }) => {
  const forceUpdate = useForceUpdate()
  const entityRef = useRef<HTMLDivElement>(null)

  const [editableArgs, setEditableArgs] = useState(entity.args)
  const [newTag, setNewTag] = useState('')
  const [tags, setTags] = useState(entity.definition.tags)

  const [tempX, setTempX] = useState<string>(roundValue(String(entity.transform.position.x), 2)[0])
  const [tempY, setTempY] = useState<string>(roundValue(String(entity.transform.position.y), 2)[0])
  const [tempRotation, setTempRotation] = useState<string>(
    roundValue(String(entity.transform.rotation), 0)[0],
  )
  const [tempZIndex, setTempZIndex] = useState<string>(
    roundValue(String(entity.transform.zIndex), 0)[0],
  )

  const handleTransformUpdate = useCallback((transform: Transform) => {
    setTempX(roundValue(String(transform.position.x), 2)[0])
    setTempY(roundValue(String(transform.position.y), 2)[0])
    setTempRotation(roundValue(String(transform.rotation), 0)[0])
    setTempZIndex(roundValue(String(transform.zIndex), 0)[0])
  }, [])

  const transform = useTransform(entity.transform, handleTransformUpdate)

  const argsInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({})

  const handleAddTag = () => {
    if (newTag && !entity.definition.tags?.includes(newTag)) {
      history.record({
        uid: entity.uid,
        type: 'update',
        actions: [{ action: 'tag-add', tag: newTag }],
      })

      entity.definition.tags?.push(newTag)
      setTags(entity.definition.tags ?? [])
      setNewTag('')
    }
  }

  const handleDeleteTag = (tagToDelete: string) => {
    setTags(prevTags => {
      const idx = prevTags.indexOf(tagToDelete)
      if (idx === -1) return prevTags

      history.record({
        uid: entity.uid,
        type: 'update',
        actions: [{ action: 'tag-remove', tag: tagToDelete }],
      })

      entity.tags.splice(idx, 1)

      return [...entity.tags]
    })
  }

  // TODO: Don't clobber arg input when args change externally
  const handleArgChange = (key: string, value: unknown) => {
    setEditableArgs(prevArgs => {
      const updatedArgs = clone(prevArgs)
      setProperty(updatedArgs, key, value)
      return updatedArgs
    })
  }

  const handleArgSave = useCallback(
    (key: string, value?: { _v: unknown }) => {
      const val = value !== undefined ? value._v : (getProperty(editableArgs, key) as unknown)

      history.record({
        uid: entity.uid,
        type: 'update',
        actions: [{ action: 'arg-update', path: key, value: val }],
      })

      setProperty(entity.args, key, val)
    },
    [editableArgs, entity, history],
  )

  const onArgsChanged = useCallback<EventHandler<'onArgsChanged'>>(
    ({ uid, args }) => {
      if (uid !== entity.uid) return

      setEditableArgs(args)
      forceUpdate()
    },
    [entity.uid, forceUpdate],
  )

  useCommonEventListener('onArgsChanged', onArgsChanged)

  const onTagsChanged = useCallback<EventHandler<'onTagsChanged'>>(
    ({ uid, tags }) => {
      if (uid !== entity.uid) return

      setTags(tags)
      forceUpdate()
    },
    [entity.uid, forceUpdate],
  )

  useCommonEventListener('onTagsChanged', onTagsChanged)

  const _recordTransformHistory = useCallback(() => {
    history.recordTransformChanged(entity)
  }, [history, entity])

  const recordTransformHistory = useDebounceCallback(_recordTransformHistory, 1_000)

  const handlePositionChange = (axis: 'x' | 'y', value: string) => {
    const [strValue, valid, numValue] = roundValue(value, 2)
    if (axis === 'x') {
      setTempX(strValue)
      if (valid) {
        transform.position.x = numValue
        recordTransformHistory()
      }
    } else if (axis === 'y') {
      setTempY(strValue)
      if (valid) {
        transform.position.y = numValue
        recordTransformHistory()
      }
    }
  }

  const handleTransformChange = (property: 'rotation' | 'zIndex', value: string) => {
    const [strValue, valid, numValue] = roundValue(value, 0)
    if (property === 'rotation') {
      setTempRotation(strValue)
      if (valid) {
        transform.rotation = numValue
        recordTransformHistory()
      }
    } else if (property === 'zIndex') {
      setTempZIndex(strValue)
      if (valid) {
        transform.zIndex = numValue
        recordTransformHistory()
      }
    }
  }

  return (
    <EntityButtons id={entity.uid} ref={entityRef}>
      <InspectorStyle>
        <InfoDetails isSelected>
          <p>
            Entity:{' '}
            {entity.definition.entity.length > 30
              ? entity.definition.entity.slice(0, 30) + '...'
              : entity.definition.entity}
          </p>
          <div className='form-field'>
            <h3>Position</h3>
            <div className='detail-row'>
              <span>X: </span>
              <input
                onChange={ev => handlePositionChange('x', ev.target.value)}
                onKeyDown={ev => {
                  if (ev.key === 'Enter') {
                    ;(ev.target as HTMLInputElement).blur()
                  }

                  ev.stopPropagation()
                }}
                type='number'
                value={tempX}
              />
            </div>
            <div className='detail-row'>
              <span>Y:</span>
              <input
                onChange={ev => handlePositionChange('y', ev.target.value)}
                onKeyDown={ev => {
                  if (ev.key === 'Enter') {
                    ;(ev.target as HTMLInputElement).blur()
                  }

                  ev.stopPropagation()
                }}
                type='number'
                value={tempY}
              />
            </div>
          </div>

          <div className='form-field'>
            <h3>Rotation & Layering</h3>
            <div className='detail-row'>
              <span>Rotation: </span>
              <input
                onChange={ev => handleTransformChange('rotation', ev.target.value)}
                onKeyDown={ev => {
                  if (ev.key === 'Enter') {
                    ;(ev.target as HTMLInputElement).blur()
                  }

                  ev.stopPropagation()
                }}
                type='number'
                value={tempRotation}
              />
            </div>
            <div className='detail-row'>
              <span>Z-Index:</span>
              <input
                onChange={ev => handleTransformChange('zIndex', ev.target.value)}
                onKeyDown={ev => {
                  if (ev.key === 'Enter') {
                    ;(ev.target as HTMLInputElement).blur()
                  }

                  ev.stopPropagation()
                }}
                type='number'
                value={tempZIndex}
              />
            </div>
          </div>

          <div>
            <div className='form-field'>
              <h3>Entity Args</h3>
              {Object.entries(editableArgs).map(([key, value], index) => {
                const schemaType = entity.argsSchema.shape[key]
                const uniqueKey = `${entity.uid}-${key}-${index}`

                return (
                  <div key={uniqueKey}>
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
            <div className='tags-container'>
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
                      backgroundColor: '#f9f9f9',
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
                  <div className='tag' key={tag}>
                    {tag.length > 20 ? `${tag.slice(0, 20)}...` : tag}
                  </div>
                </div>
              ))}

              <div className='add-tag'>
                <input
                  className='tag-input'
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
                <button onClick={handleAddTag} style={{ fontSize: '0.75rem' }} type='button'>
                  +
                </button>
              </div>
            </div>
          </div>
        </InfoDetails>
      </InspectorStyle>
    </EntityButtons>
  )
}
