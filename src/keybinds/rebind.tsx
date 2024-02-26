import type { InputCode } from '@dreamlab.gg/core/input'
import { inputCodes, InputCodeSchema } from '@dreamlab.gg/core/input'
import { useForceUpdate, useGame, useRegisteredInputs } from '@dreamlab.gg/ui/react'
import { useCallback, useEffect, useState } from 'https://esm.sh/v135/react@18.2.0'
import type { FC } from 'https://esm.sh/v135/react@18.2.0'
import { styled } from 'https://esm.sh/v135/styled-components@6.1.8'
import { Input } from './input'
import { bindInput } from './persist'

const Container = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  bottom: 0;
  right: 0;
  z-index: 1000;

  display: flex;
  align-items: center;
  justify-content: center;
  margin: 2rem;
`

const Popup = styled.div<{ readonly visible: boolean }>`
  user-select: auto;
  pointer-events: auto;

  width: 100%;
  max-height: 100%;
  max-width: 30rem;
  padding: 1rem;
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

const ResetButton = styled.button`
  margin-top: 0.75rem;
  display: inline-block;
  appearance: button;
  border: 0;
  background-color: #3c7aff;
  color: white;
  font-family: 'Inter';
  cursor: pointer;
  font-size: 1rem;
  padding: 0.75rem 1rem;
  border-radius: 0.5rem;
  transition: background-color 0.1s ease;

  &:hover {
    background-color: #2660dd;
  }
`

interface Props {
  readonly visible: boolean
  setVisible: React.Dispatch<React.SetStateAction<boolean>>
}

export const Rebind: FC<Props> = ({ visible, setVisible }) => {
  const game = useGame()
  const inputs = useRegisteredInputs()
  const forceUpdate = useForceUpdate()
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
        bindInput(game, prev, undefined)
        setRebinding(undefined)
        return
      }

      const result = InputCodeSchema.safeParse(ev.code)
      if (!result.success) return

      const code = result.data
      if (code === prev) {
        setRebinding(undefined)
      }

      bindInput(game, prev, undefined)
      bindInput(game, code, id)
      setRebinding(undefined)
    },
    [game, inputs, rebinding, setRebinding],
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

        const code = ev.button === 0 ? 'MouseLeft' : ev.button === 1 ? 'MouseMiddle' : 'MouseRight'

        bindInput(game, prev, undefined)
        bindInput(game, code, id)
        setRebinding(undefined)
      } else {
        setRebinding([id, type])
      }
    },
    [game, inputs, rebinding, setRebinding],
  )

  const onReset = useCallback(() => {
    // Unbind all keys
    for (const key of inputCodes) {
      bindInput(game, key, undefined)
    }

    forceUpdate()
  }, [game, forceUpdate])

  useEffect(() => {
    window.addEventListener('keydown', onKeyPress)

    return () => {
      window.removeEventListener('keydown', onKeyPress)
    }
  })

  return (
    <Container>
      <Popup visible={visible}>
        <Header>
          <H1>Rebind Inputs</H1>
          <CloseIcon onClick={close}>
            <svg
              className='w-6 h-6'
              fill='none'
              stroke='currentColor'
              strokeWidth={1.5}
              viewBox='0 0 24 24'
              xmlns='http://www.w3.org/2000/svg'
            >
              <path d='M6 18L18 6M6 6l12 12' strokeLinecap='round' strokeLinejoin='round' />
            </svg>
          </CloseIcon>
        </Header>

        <InputGrid>
          {inputs.map(([id, name, keys]) => (
            <Input
              active={rebinding && rebinding[0] === id ? rebinding[1] : undefined}
              id={id}
              key={id}
              keys={keys}
              name={name}
              onClick={onClick}
            />
          ))}
        </InputGrid>

        <ResetButton onClick={onReset} type='button'>
          Reset
        </ResetButton>
      </Popup>
    </Container>
  )
}
