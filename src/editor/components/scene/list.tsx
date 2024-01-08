/* eslint-disable typescript-sort-keys/string-enum */
// The order of my enums affects the order they're rendered on the UI!
import type { SpawnableEntity } from '@dreamlab.gg/core'
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
  useMemo,
  useState,
} from 'https://esm.sh/v136/react@18.2.0'
import type { ChangeEvent, FC } from 'https://esm.sh/v136/react@18.2.0'
import { styled } from 'https://esm.sh/v136/styled-components@6.1.6'
import type { Action } from '../../editor'
import { EditorInputs } from '../../editor'
import type { Selector } from '../../entities/select'
import CollapsibleSection from '../palette/collapsablesection'
import type { History } from '../palette/spawnables'
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
  gap: 0.2rem;
  overflow-y: overlay;
`

enum GroupByOptions {
  None = 'No Grouping',
  Type = 'Type',
  Tag = 'Tag',
}
interface GroupedSpawnableEntities {
  [key: string]: SpawnableEntity[]
}

function setContainsSelected(
  set: SpawnableEntity[],
  selected: string | undefined,
): boolean {
  for (const _e of set) {
    if (_e.uid === selected) {
      return true
    }
  }

  return false
}

const GroupedEntitySet = (
  groupedEntities: GroupedSpawnableEntities,
  history: History,
  selector: Selector,
  selected: string | undefined,
) => {
  return Object.keys(groupedEntities).map(group => (
    <CollapsibleSection
      forceOpen={setContainsSelected(groupedEntities[group], selected)}
      key={group}
      title={group}
    >
      <EntityList>
        {groupedEntities[group].map(entity => (
          <EntityDisplay
            entity={entity}
            history={history}
            isSelected={entity.uid === selected}
            key={entity.uid}
            selector={selector}
          />
        ))}
      </EntityList>
    </CollapsibleSection>
  ))
}

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

  const entities = useMemo(() => {
    return [...etys].sort((a, b) =>
      a.definition.entity.localeCompare(b.definition.entity),
    )
  }, [etys])

  const entitiesGroupedByType = useMemo(() => {
    const grouped: GroupedSpawnableEntities = {}
    for (const _entity of entities) {
      const entityType = _entity.definition.entity

      if (grouped[entityType]) {
        grouped[entityType].push(_entity)
      } else {
        grouped[entityType] = [_entity]
      }
    }

    return grouped
  }, [entities])

  const entitiesGroupedByTag = useMemo(() => {
    const grouped: GroupedSpawnableEntities = {}
    const taglessEntities = []

    for (const _entity of entities) {
      const entityTags = _entity.tags
      for (const tag of entityTags) {
        if (grouped[tag]) {
          grouped[tag].push(_entity)
        } else {
          grouped[tag] = [_entity]
        }
      }

      if (entityTags.length === 0) {
        taglessEntities.push(_entity)
      }
    }

    grouped['No tags'] = taglessEntities

    return grouped
  }, [entities])

  const [isCollapsed, setIsCollapsed] = useState(false)
  const toggleCollapse = useCallback(() => setIsCollapsed(prev => !prev), [])

  const [selected, setSelected] = useState<string | undefined>(undefined)
  const onSelect = useCallback(
    (id: string | undefined) => setSelected(id),
    [setSelected],
  )

  const [groupBy, setGroupBy] = useState<GroupByOptions>(GroupByOptions.None)
  const onChangeGroupBy = useCallback(
    (event: ChangeEvent<HTMLSelectElement>) => {
      const newValue = event.target.value as GroupByOptions
      if (Object.values(GroupByOptions).includes(newValue)) {
        setGroupBy(newValue)
        selector.deselect()
      }
    },
    [selector],
  )
  const groupingOptions = Object.entries(GroupByOptions).map(([key, value]) => (
    <option key={key} value={value}>
      {value}
    </option>
  ))

  const onDelete = useCallback(async () => {
    if (!selector.selected) return

    /*
    I disabled this because the use of confirm() was interfering with the input handlers.

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
    if (
      !selector.selected ||
      typeof selector.selected.args.spriteSource !== 'object'
    )
      return
    const originalSpritesource = selector.selected.args.spriteSource.url
    const originalTiling = selector.selected.args.spriteSource.tile
    const newSpritesource: SpriteSource = {
      url: originalSpritesource,
      tile: !originalTiling,
    }
    selector.selected.args.spriteSource = newSpritesource
    selector.events.emit(
      'onArgsUpdate',
      selector.selected.uid,
      selector.selected.args,
    )
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
          Object List
          <select
            onChange={onChangeGroupBy}
            style={{ marginBottom: '5px' }}
            value={groupBy}
          >
            {groupingOptions}
          </select>
          {groupBy === GroupByOptions.None && (
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
          )}
          {groupBy === GroupByOptions.Type &&
            GroupedEntitySet(
              entitiesGroupedByType,
              history,
              selector,
              selected,
            )}
          {groupBy === GroupByOptions.Tag &&
            GroupedEntitySet(entitiesGroupedByTag, history, selector, selected)}
          <Button onClick={onSave} type='button'>
            Save
          </Button>
        </>
      )}
    </ListContainer>
  )
}
