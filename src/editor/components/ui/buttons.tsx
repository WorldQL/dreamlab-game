import { styled } from 'https://esm.sh/styled-components@6.1.8?pin=v135'

export const Button = styled.button`
  display: inline-block;
  appearance: button;
  border: 0;
  background-color: #2b59ff;
  color: white;
  font-family: 'Inter';
  cursor: pointer;
  padding: 0.5rem 1rem;
  border-radius: 0.5rem;
  transition: background-color 0.1s ease;
  font-weight: 500;
  letter-spacing: 0.025em;
  transition: all 0.3s ease;

  &:hover {
    background-color: #1e44d6;
  }
`

export const LinkButton = styled.a`
  display: inline-block;
  appearance: button;
  border: 0;
  text-decoration: none;
  background-color: #2b59ff;
  color: white;
  font-family: 'Inter';
  cursor: pointer;
  padding: 0.5rem 1rem;
  border-radius: 0.5rem;
  transition: background-color 0.1s ease;
  font-weight: 500;
  letter-spacing: 0.025em;
  transition: all 0.3s ease;

  &:hover {
    background-color: #1e44d6;
  }
`

export const CollapseButton = styled.button`
  position: absolute;
  top: 0.3rem;
  background-color: transparent;
  color: #4a4a4a;
  border: none;
  cursor: pointer;
  padding: 0.5rem;
  border-radius: 0.3rem;
  font-size: 1.2rem;
  transition:
    background-color 0.3s,
    color 0.3s;

  &:hover {
    background-color: rgba(0, 0, 0, 0.1);
    color: #2c2c2c;
  }

  &:focus {
    outline: none;
  }
`

export const IconButton = styled.div<{ isLocked?: boolean }>`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2px;
  border-radius: 2px;
  cursor: pointer;
  transition: background-color 0.3s ease;

  &:hover {
    background-color: #efefef;
  }

  & svg {
    width: 1rem;
    height: 1rem;
  }
`

export const LockButton = styled(IconButton)`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2px;
  margin-left: 2px;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.3s ease;
  background-color: ${props => (props.isLocked ? '#ef4444' : '#999')};

  &:hover {
    background-color: ${props => (props.isLocked ? '#b91c1c' : '#777')};
  }
`

export const DeleteButton = styled(IconButton)`
  background-color: #ef4444;

  &:hover {
    background-color: #b91c1c;
  }
`
