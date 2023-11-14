import type { InputCode } from '@dreamlab.gg/core/input'
import { useGame } from '@dreamlab.gg/ui/react'
import type { FC } from 'https://esm.sh/react@18.2.0'
import { styled } from 'https://esm.sh/styled-components@6.1.1'

const Name = styled.p`
  margin: 0;
  margin-right: 1rem;
`

const InputKey = styled.div`
  font-family: 'Fira Code', ui-monospace, monospace;
  padding: 0.375rem 0.5rem;
  border: 1px solid #a3a3a3;
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
}

export const Input: FC<Props> = ({ name, keys }) => {
  const game = useGame()
  const inputs = game.client.inputs

  const primary = keys[0]!
  const secondary: InputCode | undefined = keys[1]

  const keyPrimary = inputs.getKeyName(primary)
  const keySecondary = secondary ? inputs.getKeyName(secondary) : '-'

  return (
    <>
      <Name>{name}</Name>
      <InputKey>{keyPrimary}</InputKey>
      <InputKey>{keySecondary}</InputKey>
    </>
  )
}
