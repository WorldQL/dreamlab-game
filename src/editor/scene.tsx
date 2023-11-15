import type { SpawnableEntity } from '@dreamlab.gg/core'
import { useGame, usePlayer, useSpawnableEntities } from '@dreamlab.gg/ui/react'
import { useCallback } from 'https://esm.sh/react@18.2.0'
import type { FC } from 'https://esm.sh/react@18.2.0'
import { styled } from 'https://esm.sh/styled-components@6.1.1'
import { Button, Container } from './components'
import type { Selector } from './select'

const ListContainer = styled(Container)`
  top: var(--margin);
  left: var(--margin);
  bottom: var(--margin);
`

const EntityList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`

export const SceneList: FC<{ readonly selector: Selector }> = ({
  selector,
}) => {
  const etys = useSpawnableEntities()
  const entities = [...etys].sort((a, b) =>
    a.definition.entity.localeCompare(b.definition.entity),
  )

  return (
    <ListContainer>
      <h1>Object List</h1>

      <EntityList>
        {entities.map(entity => (
          // eslint-disable-next-line @typescript-eslint/no-use-before-define
          <EntityDisplay key={entity.uid} entity={entity} selector={selector} />
        ))}
      </EntityList>
    </ListContainer>
  )
}

const EntityButtons = styled.div`
  display: flex;
  gap: 0.25rem;
`

const SelectButton = styled(Button)`
  flex-grow: 1;
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
`

const DeleteButton = styled(IconButton)`
  background-color: #ef4444;

  &:hover {
    background-color: #b91c1c;
  }
`

const EntityDisplay: FC<{
  readonly selector: Selector
  entity: SpawnableEntity
}> = ({ selector, entity }) => {
  const game = useGame()
  const player = usePlayer()

  const onFocus = useCallback(() => {
    if (!player) return
    player.teleport(entity.transform.position, true)
  }, [player])

  const onDelete = useCallback(async () => {
    await game.destroy(entity)
  }, [entity])

  return (
    <EntityButtons id={entity.uid}>
      <SelectButton type='button' onClick={() => selector.select(entity)}>
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
