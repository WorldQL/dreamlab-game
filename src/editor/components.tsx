import { styled } from 'https://esm.sh/styled-components@6.1.1'

export const Container = styled.div`
  --margin: 1rem;
  position: fixed;

  pointer-events: auto;
  user-select: auto;
  z-index: 500;

  width: max-content;
  min-width: 22rem;

  padding: 1rem;
  border-radius: 0.5rem;
  background-color: rgba(230 230 230 / 1);
  box-shadow:
    0 4px 6px -1px rgb(0 0 0 / 0.3),
    0 2px 4px -2px rgb(0 0 0 / 0.3);

  display: flex;
  flex-direction: column;
`

export const Button = styled.button`
  display: inline-block;
  appearance: button;
  border: 0;
  background-color: #3b82f6;
  color: white;
  font-family: 'Inter';
  cursor: pointer;
  padding: 0.5rem 1rem;
  border-radius: 0.5rem;
  transition: background-color 0.1s ease;

  &:hover {
    background-color: #1d4ed8;
  }
`