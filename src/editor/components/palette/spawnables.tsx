import type { LooseSpawnableDefinition, SpawnableEntity } from '@dreamlab.gg/core'
import { useGame, useNetwork, useRegisteredSpawnables } from '@dreamlab.gg/ui/react'
import cuid2 from '@paralleldrive/cuid2'
import { useCallback, useState } from 'https://esm.sh/react@18.2.0'
import { styled } from 'https://esm.sh/styled-components@6.1.8?pin=v135'
import type { History } from '../../entities/history'
import type { Navigator } from '../../entities/navigator'
import type { Selector } from '../../entities/select'

const SpawnableList = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 0.75rem;
  overflow-y: auto;
  padding: 0.75rem;
`

const SpawnableButton = styled.button`
  background-color: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 0.5rem;
  text-align: center;
  font-size: 14px;
  color: #1f2937;
  cursor: pointer;
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  }
`

const SpawnablesContainer = styled.div`
  margin-top: 1rem;
  background-color: #f9fafb;
  border-radius: 8px;
  padding: 1rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
`

const SpawnablesTitle = styled.h3`
  font-size: 18px;
  font-weight: 600;
  color: #1f2937;
  margin-bottom: 1rem;
  text-align: center;
`

const SpawnablesDesc = styled.h3`
  font-size: 12px;
  font-weight: 400;
  color: #1f2937;
  margin-bottom: 1rem;
  text-align: center;
`

const CategoryContainer = styled.div`
  margin-bottom: 1rem;
`

const CategoryTitle = styled.h4`
  font-size: 16px;
  font-weight: 600;
  color: #1f2937;
  margin-bottom: 0.5rem;
  cursor: pointer;
  display: flex;
  align-items: center;
`

const CategoryIcon = styled.span`
  margin-right: 0.5rem;
  transition: transform 0.2s ease;

  &.collapsed {
    transform: rotate(-90deg);
  }
`

const TooltipContainer = styled.div`
  position: relative;
  display: inline-block;
  cursor: pointer;
`

const TooltipIcon = styled.span`
  font-size: 16px;
  color: #6b7280;
  margin-right: 0.5rem;
`

const TooltipText = styled.div`
  visibility: hidden;
  width: 200px;
  background-color: #1f2937;
  color: #fff;
  text-align: center;
  border-radius: 6px;
  padding: 0.5rem;
  position: absolute;
  z-index: 1;
  bottom: 125%;
  left: 50%;
  transform: translateX(-50%);
  opacity: 0;
  transition: opacity 0.3s;

  &::after {
    content: '';
    position: absolute;
    top: 100%;
    left: 50%;
    margin-left: -5px;
    border-width: 5px;
    border-style: solid;
    border-color: #1f2937 transparent transparent transparent;
  }

  ${TooltipContainer}:hover & {
    visibility: visible;
    opacity: 1;
  }
`

interface SpawnablesProps {
  selector: Selector
  navigator: Navigator
  history: History
}

export const Spawnables: React.FC<SpawnablesProps> = ({ selector, navigator, history }) => {
  const game = useGame()
  const network = useNetwork()
  const registered = useRegisteredSpawnables()
  const spawnable = registered.filter(({ hasDefaults }) => hasDefaults)
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({})

  // make background not be able to be spawned manually
  const indexOfBackground = spawnable.findIndex(({ name }) => name === '@dreamlab/Background')
  spawnable.splice(indexOfBackground, 1)

  const spawn = useCallback(
    async (definition: Omit<LooseSpawnableDefinition, 'uid'> & { uid: string }) =>
      new Promise<SpawnableEntity | undefined>(resolve => {
        if (network) {
          const onSpawn = (entity: SpawnableEntity) => {
            if (entity.uid !== definition.uid) return
            game.events.common.removeListener('onSpawn', onSpawn)
            resolve(entity)
          }

          game.events.common.addListener('onSpawn', onSpawn)
          window.sendPacket?.({
            t: 'SpawnEntity',
            definition,
          })
        } else {
          const entity = game.spawn(definition)
          resolve(entity)
        }
      }),
    [game, network],
  )

  const create = useCallback(
    async (entityName: string) => {
      const uid = cuid2.createId()
      const definition = {
        entity: entityName,
        args: {},
        transform: {
          position: navigator.position,
          zIndex: 100,
        },
        uid,
      } satisfies LooseSpawnableDefinition
      const entity = await spawn(definition)
      if (entity) {
        selector.select(entity)
        history.recordCreated(entity)
      }
    },
    [history, navigator.position, selector, spawn],
  )

  const toggleCategory = (category: string) => {
    setCollapsedCategories(prevState => ({
      ...prevState,
      [category]: !prevState[category],
    }))
  }

  const dreamlabSpawnables = spawnable.filter(({ name }) => name.startsWith('@dreamlab/'))
  const otherSpawnables = spawnable.filter(({ name }) => !name.startsWith('@dreamlab/'))

  return (
    <SpawnablesContainer>
      <SpawnablesTitle>Spawn Object</SpawnablesTitle>
      <SpawnablesDesc>Click to spawn an enitity!</SpawnablesDesc>
      <CategoryContainer>
        <CategoryTitle onClick={() => toggleCategory('dreamlab')}>
          <CategoryIcon className={collapsedCategories.dreamlab ? 'collapsed' : ''}>▼</CategoryIcon>
          Dreamlab entities:
        </CategoryTitle>
        {!collapsedCategories.dreamlab && (
          <SpawnableList>
            {dreamlabSpawnables.map(({ name }) => (
              <SpawnableButton key={name} onClick={async () => create(name)}>
                {name.replace('@dreamlab/', '')}
              </SpawnableButton>
            ))}
          </SpawnableList>
        )}
      </CategoryContainer>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.5rem' }}>
        <TooltipContainer>
          <TooltipIcon>World script entities:</TooltipIcon>
          <TooltipText>
            Entities with default values defined for all arguments in the world script will appear
            here.
          </TooltipText>
        </TooltipContainer>
      </div>
      <SpawnableList>
        {otherSpawnables.map(({ name }) => (
          <SpawnableButton key={name} onClick={async () => create(name)}>
            {name}
          </SpawnableButton>
        ))}
      </SpawnableList>
    </SpawnablesContainer>
  )
}
