import type { InputCode } from '@dreamlab.gg/core/dist/input'
import { InputCodeSchema } from '@dreamlab.gg/core/dist/input'
import { useGame, useRegisteredInputs } from '@dreamlab.gg/ui/react'
import { useCallback, useEffect, useState } from 'https://esm.sh/react@18.2.0'
import type { FC } from 'https://esm.sh/react@18.2.0'
import { styled } from 'https://esm.sh/styled-components@6.1.1'
import { Input } from './input'

const Container = styled.div<{ readonly visible: boolean }>`
  user-select: auto;
  pointer-events: auto;
  z-index: 1000;

  position: fixed;
  top: 0;
  left: 0;
  bottom: 0;
  right: 0;

  padding: 1rem;
  margin: 2rem;
  border-radius: 1rem;

  display: flex;
  flex-direction: column;

  background-color: rgba(230 230 230 / 1);
  box-shadow:
    0 4px 6px -1px rgb(0 0 0 / 0.3),
    0 2px 4px -2px rgb(0 0 0 / 0.3);

  transition: opacity 0.2s ease;
  opacity: ${props => (props.visible ? '1' : '0')};
  pointer-events: ${props => (props.visible ? 'auto' : 'none')};
`

const Header = styled.div`
  display: flex;
`

const H1 = styled.h1`
  flex-grow: 1;
  margin: 0.5rem 0;
`

const CloseIcon = styled.div`
  --size: 3rem;

  width: var(--size);
  height: var(--size);

  cursor: pointer;
`

const InputGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, max-content);
  align-items: center;
  row-gap: 0.5rem;
  column-gap: 0.5rem;
  overflow-y: overlay;
  padding: 0.5rem 0;
`

interface Props {
  readonly visible: boolean
  setVisible: React.Dispatch<React.SetStateAction<boolean>>
}

export const Rebind: FC<Props> = ({ visible, setVisible }) => {
  const game = useGame()
  const inputs = useRegisteredInputs()
  const close = useCallback(() => setVisible(false), [setVisible])

  const [rebinding, setRebinding] = useState<
    [id: string, name: 'primary' | 'secondary'] | undefined
  >(undefined)

  const onKeyPress = useCallback(
    (ev: KeyboardEvent) => {
      if (!rebinding) return

      const input = inputs.find(([id]) => id === rebinding[0])
      if (!input) return

      const [id, _name, keys] = input
      const primary = keys[0]!
      const secondary: InputCode | undefined = keys[1]
      const prev = rebinding[1] === 'primary' ? primary : secondary

      if (ev.code === 'Escape') {
        game.client.inputs.bindInput(prev, undefined)
        setRebinding(undefined)
        return
      }

      const result = InputCodeSchema.safeParse(ev.code)
      if (!result.success) return

      const code = result.data
      if (code === prev) {
        setRebinding(undefined)
      }

      game.client.inputs.bindInput(prev, undefined)
      game.client.inputs.bindInput(code, id)
      setRebinding(undefined)
    },
    [inputs, rebinding, setRebinding],
  )

  const onClick = useCallback(
    (ev: React.MouseEvent, id: string, type: 'primary' | 'secondary') => {
      if (rebinding && rebinding[0] === id && type === rebinding[1]) {
        const input = inputs.find(([id]) => id === rebinding[0])
        if (!input) return

        const [id, _name, keys] = input
        const primary = keys[0]!
        const secondary: InputCode | undefined = keys[1]
        const prev = rebinding[1] === 'primary' ? primary : secondary

        const code =
          ev.button === 0
            ? 'MouseLeft'
            : ev.button === 1
            ? 'MouseMiddle'
            : 'MouseRight'

        game.client.inputs.bindInput(prev, undefined)
        game.client.inputs.bindInput(code, id)
        setRebinding(undefined)
      } else {
        setRebinding([id, type])
      }
    },
    [rebinding, setRebinding],
  )

  useEffect(() => {
    window.addEventListener('keydown', onKeyPress)

    return () => {
      window.removeEventListener('keydown', onKeyPress)
    }
  })

  return (
    <Container visible={visible}>
      <Header>
        <H1>Rebind Inputs</H1>
        <CloseIcon onClick={close}>
          <svg
            xmlns='http://www.w3.org/2000/svg'
            fill='none'
            viewBox='0 0 24 24'
            strokeWidth={1.5}
            stroke='currentColor'
            className='w-6 h-6'
          >
            <path
              strokeLinecap='round'
              strokeLinejoin='round'
              d='M6 18L18 6M6 6l12 12'
            />
          </svg>
        </CloseIcon>
      </Header>

      <InputGrid>
        {inputs.map(([id, name, keys]) => (
          <Input
            key={id}
            id={id}
            name={name}
            keys={keys}
            onClick={onClick}
            active={rebinding && rebinding[0] === id ? rebinding[1] : undefined}
          />
        ))}
      </InputGrid>
    </Container>
  )
}
