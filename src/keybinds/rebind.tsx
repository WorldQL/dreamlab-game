import { useRegisteredInputs } from '@dreamlab.gg/ui/react'
import { useCallback } from 'https://esm.sh/react@18.2.0'
import type { FC } from 'https://esm.sh/react@18.2.0'
import { styled } from 'https://esm.sh/styled-components@6.1.1'

const Container = styled.div`
  user-select: auto;
  pointer-events: auto;

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
`

const Header = styled.div`
  display: flex;
  margin-bottom: 0.5rem;
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

interface Props {
  setVisible: React.Dispatch<React.SetStateAction<boolean>>
}

export const Rebind: FC<Props> = ({ setVisible }) => {
  const inputs = useRegisteredInputs()
  const close = useCallback(() => setVisible(false), [setVisible])

  return (
    <Container>
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

      <div>
        {inputs.map(([id, name, keys]) => (
          <div key={id}>{name}</div>
        ))}
      </div>
    </Container>
  )
}
