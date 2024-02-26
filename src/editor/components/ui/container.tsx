import { styled } from 'https://esm.sh/styled-components@6.1.8?pin=v135'

export const Container = styled.div`
  --margin: 1rem;
  position: fixed;

  pointer-events: auto;
  user-select: auto;
  z-index: 500;

  width: 18rem;
  min-width: 10rem;
  max-width: 100%;
  height: auto;
  min-height: 5rem;
  max-height: 100vh;

  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
  padding: 1rem;
  border-radius: 0.5rem;
  outline: 1px rgba(200 200 200 / 1) solid;
  background-color: rgba(230 230 230 / 1);
  box-shadow:
    0 4px 6px -1px rgb(0 0 0 / 0.3),
    0 2px 4px -2px rgb(0 0 0 / 0.3);

  display: flex;
  flex-direction: column;

  overflow: auto;
`
