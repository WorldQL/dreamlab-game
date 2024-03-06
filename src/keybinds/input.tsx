import type { InputCode } from '@dreamlab.gg/core/input'
import { useGame } from '@dreamlab.gg/ui/react'
import { useCallback } from 'https://esm.sh/react@18.2.0'
import type { FC, MouseEventHandler } from 'https://esm.sh/react@18.2.0'
import { styled } from 'https://esm.sh/styled-components@6.1.8?pin=v135'

const Name = styled.p`
  margin: 0;
  margin-right: 1rem;
`

const InputKey = styled.div<{ readonly active: boolean }>`
  font-family: 'Fira Code', ui-monospace, monospace;
  padding: 0.375rem 0.5rem;
  outline-style: solid;
  outline-color: ${props => (props.active ? '#888' : '#a3a3a4')};
  outline-width: ${props => (props.active ? '2px' : '1px')};
  border-radius: 0.375rem;
  background-color: white;
  cursor: pointer;
  min-width: 10ch;
  text-align: center;
`

interface Props {
  readonly id: string
  readonly name: string
  readonly keys: readonly InputCode[]

  readonly active: 'primary' | 'secondary' | undefined
  onClick(ev: React.MouseEvent, id: string, type: 'primary' | 'secondary'): void
}

export const Input: FC<Props> = ({ id, name, keys, active, onClick }) => {
  const game = useGame()
  const inputs = game.client.inputs

  const primary = keys[0]!
  const secondary: InputCode | undefined = keys[1]

  const keyPrimary = inputs.getKeyName(primary)
  const keySecondary = secondary ? inputs.getKeyName(secondary) : '-'

  const onContextMenu = useCallback<MouseEventHandler>(ev => {
    ev.preventDefault()
    return false
  }, [])

  return (
    <>
      <Name>{name}</Name>

      <InputKey
        active={active === 'primary'}
        onContextMenu={onContextMenu}
        onMouseDown={ev => onClick(ev, id, 'primary')}
      >
        {keyPrimary}
      </InputKey>

      <InputKey
        active={active === 'secondary'}
        onContextMenu={onContextMenu}
        onMouseDown={ev => onClick(ev, id, 'secondary')}
      >
        {keySecondary}
      </InputKey>
    </>
  )
}
