import { styled } from 'https://esm.sh/v136/styled-components@6.1.1'

export const Container = styled.div`
  --margin: 1rem;
  position: fixed;

  pointer-events: auto;
  user-select: auto;
  z-index: 500;

  width: 18rem; // Initial width
  min-width: 10rem; // Minimum width
  max-width: 100%; // Maximum width to avoid overflowing the screen
  height: auto; // Height to be determined by content initially
  min-height: 5rem; // Minimum height
  max-height: 100vh; // Maximum height

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

  resize: both; // Enables resizing both horizontally and vertically
  overflow: auto; // Adds scrollbars when content overflows
`
