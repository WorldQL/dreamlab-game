import type { SpriteSource } from '@dreamlab.gg/core/textures'
import {
  useEventListener,
  useForceUpdate,
  useGame,
  useInputPressed,
  useNetwork,
  useSpawnableEntities,
} from '@dreamlab.gg/ui/react'
import {
  useCallback,
  useEffect,
  useState,
} from 'https://esm.sh/v136/react@18.2.0'
import type { FC } from 'https://esm.sh/v136/react@18.2.0'
import { styled } from 'https://esm.sh/v136/styled-components@6.1.6'
import type { Action } from '../../editor'
import { EditorInputs } from '../../editor'
import type { Selector } from '../../entities/select'
import { Button, CollapseButton } from '../ui/buttons'
import { Container } from '../ui/container'
import { EntityDisplay } from './display'

const ListContainer = styled(Container)<{ isCollapsed: boolean }>`
  top: 6rem;
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

export const SceneList: FC<{
  readonly selector: Selector
  history: {
    record(action: Action): void
    undo(): void
    getActions(): Action[]
  }
}> = ({ selector, history }) => {
  const game = useGame()
  const network = useNetwork()
  const forceUpdate = useForceUpdate()

  const etys = useSpawnableEntities()
  const entities = [...etys].sort((a, b) =>
    a.definition.entity.localeCompare(b.definition.entity),
  )

  const [isCollapsed, setIsCollapsed] = useState(false)
  const toggleCollapse = useCallback(() => setIsCollapsed(prev => !prev), [])

  const [selected, setSelected] = useState<string | undefined>(undefined)
  const onSelect = useCallback(
    (id: string | undefined) => setSelected(id),
    [setSelected],
  )

  const onDelete = useCallback(async () => {
    if (!selector.selected) return

    /*
    I disabled this because the use of confirm() was interfering with
    // eslint-disable-next-line no-alert
    const confirmDeletion = confirm(
      `Are you sure you want to delete "${selector.selected.definition.entity}"?`,
    )
    if (!confirmDeletion) return
    */

    const id = selector.selected.uid
    history.record({
      type: 'delete',
      definition: selector.selected.definition,
    })
    await game.destroy(selector.selected)
    await network?.sendEntityDestroy(id)
  }, [game, history, network, selector.selected])

  const [ctrlHeldDown, setCtrlHeldDown] = useState(false)

  useEffect(() => {
    const handleKeyDown = (event: { key: string }) => {
      if (event.key === 'Control') {
        setCtrlHeldDown(true)
      }
    }

    const handleKeyUp = (event: { key: string }) => {
      if (event.key === 'Control') {
        setCtrlHeldDown(false)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('keyup', handleKeyUp)

    // Clean up event listeners
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('keyup', handleKeyUp)
    }
  }, [])

  const onMoveForewards = useCallback(async () => {
    if (!selector.selected) return
    selector.selected.transform.zIndex += ctrlHeldDown ? 25 : 1
    forceUpdate()
    selector.events.emit(
      'onTransformUpdate',
      selector.selected.uid,
      selector.selected.transform,
    )
  }, [selector.selected, selector.events, ctrlHeldDown, forceUpdate])

  const onMoveBackwards = useCallback(async () => {
    if (!selector.selected) return
    selector.selected.transform.zIndex -= ctrlHeldDown ? 25 : 1
    forceUpdate()
    selector.events.emit(
      'onTransformUpdate',
      selector.selected.uid,
      selector.selected.transform,
    )
  }, [selector.selected, selector.events, ctrlHeldDown, forceUpdate])

  const onChangeTiling = useCallback(async () => {
    if (!selector.selected) return
    if (typeof selector.selected.args.spriteSource === 'string') {
      const originalSpritesource = selector.selected.args.spriteSource
      const newSpritesource: SpriteSource = {
        url: originalSpritesource,
        tile: true,
      }
      selector.selected.args.spriteSource = newSpritesource
      selector.events.emit(
        'onArgsUpdate',
        selector.selected.uid,
        selector.selected.args,
      )
    } else if (typeof selector.selected.args.spriteSource === 'object') {
      const originalSpritesource = selector.selected.args.spriteSource
      const newSpritesource: SpriteSource = originalSpritesource.url
      selector.selected.args.spriteSource = newSpritesource
      selector.events.emit(
        'onArgsUpdate',
        selector.selected.uid,
        selector.selected.args,
      )
    }
    // forceUpdate()
  }, [selector.events, selector.selected])

  useEventListener(selector.events, 'onSelect', onSelect)
  useInputPressed(EditorInputs.DeleteEntity, onDelete)
  useInputPressed(EditorInputs.MoveBackwards, onMoveBackwards)
  useInputPressed(EditorInputs.MoveForewards, onMoveForewards)
  useInputPressed(EditorInputs.ToggleTiling, onChangeTiling)

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
    <ListContainer isCollapsed={isCollapsed}>
      <CollapseButton
        onClick={toggleCollapse}
        style={{
          right: '0.3rem',
        }}
      >
        {isCollapsed ? (
          <svg
            height='16'
            viewBox='0 0 256 512'
            width='8'
            xmlns='http://www.w3.org/2000/svg'
          >
            <path d='M246.6 278.6c12.5-12.5 12.5-32.8 0-45.3l-128-128c-9.2-9.2-22.9-11.9-34.9-6.9s-19.8 16.6-19.8 29.6l0 256c0 12.9 7.8 24.6 19.8 29.6s25.7 2.2 34.9-6.9l128-128z' />
          </svg>
        ) : (
          <svg
            height='16'
            viewBox='0 0 256 512'
            width='8'
            xmlns='http://www.w3.org/2000/svg'
          >
            <path d='M9.4 278.6c-12.5-12.5-12.5-32.8 0-45.3l128-128c9.2-9.2 22.9-11.9 34.9-6.9s19.8 16.6 19.8 29.6l0 256c0 12.9-7.8 24.6-19.8 29.6s-25.7 2.2-34.9-6.9l-128-128z' />
          </svg>
        )}
      </CollapseButton>
      {!isCollapsed && (
        <>
          <h1>Object List</h1>
          <EntityList>
            {entities.map(entity => (
              <EntityDisplay
                entity={entity}
                history={history}
                isSelected={entity.uid === selected}
                key={entity.uid}
                selector={selector}
              />
            ))}
          </EntityList>
          <Button onClick={onSave} type='button'>
            Save
          </Button>
        </>
      )}
    </ListContainer>
  )
}
