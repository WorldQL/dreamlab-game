import type { Game } from '@dreamlab.gg/core'
import { renderUI as renderReact } from '@dreamlab.gg/ui/react'
import type { FC, ReactNode } from 'react'
import { useEffect, useState } from 'react'
import type { LogStreamingClient } from './log-stream'

// react is probably a bad fit for this because we are just appending to a long list,
// and don't need to rerender the whole thing, but whatever for now

const DraggableWindow: FC<{ readonly children: ReactNode }> = ({ children }) => {
  const [x, _] = useState(150)
  const [y, __] = useState(150)

  // TODO: dragging behavior (setX, setY on mousemove when mouse down on header)

  return (
    <main
      className='console-window'
      style={{
        left: `${x}px`,
        top: `${y}px`,
      }}
    >
      {children}
    </main>
  )
}

const Console: FC<{ readonly client: LogStreamingClient }> = ({ client }) => {
  const [logHistory, setLogHistory] = useState<[Date, string][]>()

  useEffect(() => {
    const listener = () => {
      setLogHistory(client.history)
    }

    client.addListener(listener)

    return () => client.removeListener(listener)
  }, [client])

  const entries = []
  if (logHistory) {
    for (let idx = logHistory.length - 1; idx >= 0; idx--) {
      const [date, message] = logHistory[idx]
      entries.push(
        <li key={idx}>
          <time>{date.toISOString()}</time>
          <p>{message}</p>
        </li>,
      )
    }
  }

  return (
    <DraggableWindow>
      <section className='log'>
        <ul>{entries}</ul>
      </section>
    </DraggableWindow>
  )
}

export const renderUI = (game: Game<false>, client: LogStreamingClient) => {
  const styles = document.createElement('style')
  styles.textContent = `
    .console-window {
      position: absolute;
      z-index: 999;

      max-width: 80ch;
      min-height: 12em;
      max-height: 12em;
      resize: both;

      background: white;
      border-radius: 8px;
      padding: 1em;

      overflow-y: scroll;
      overflow-x: auto;
    }

    .log ul {
      display: flex;
      flex-direction: column-reverse;
    }

    .log li {
      display: flex;
      gap: 1em;
      align-items: center;
      background: white;
    }

    .log li:hover {
      background: #efefef;
    }

    .log li time {
      width: 30ch;
      font-family: monospace;
    }

    .log li p {
      flex: 1;
      font-family: monospace;
      white-space: nowrap;
    }
  `

  const ui = renderReact(game, <Console client={client} />, {
    interactable: false,
  })
  ui.root.append(styles)

  return ui
}
