/* eslint-disable react/iframe-missing-sandbox */
import type { FC } from 'react'
import { useState, useEffect } from 'react'
import type { EditDetails } from '../../editor'
import { Card } from '../ui/card'

export const ConsoleLog: FC<{ readonly editDetails?: EditDetails }> = ({ editDetails }) => {
  const server = editDetails?.server
  const instance = editDetails?.instance
  const secret = editDetails?.secret
  const [isMinimized, setIsMinimized] = useState(true)

  const iframeSrc =
    server && instance && secret
      ? `/log-viewer/index.html?${new URLSearchParams({
          connect: `${server}api/v1/log-stream/${instance}`,
          secret,
        }).toString()}`
      : 'about:blank'

  useEffect(() => {
    const listener = (ev: MessageEvent) => {
      if (ev.data !== 'log-viewer:clear') return
      if (!server || !instance || !secret) return

      const editUrl = new URL(server)
      editUrl.protocol = editUrl.protocol === 'wss:' ? 'https:' : 'http:'
      editUrl.pathname = `/api/v1/edit/${instance}/clear-logs`

      void fetch(editUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${secret}`,
        },
      })
    }

    window.addEventListener('message', listener)
    return () => window.removeEventListener('message', listener)
  }, [server, instance, secret])

  const toggleMinimize = () => {
    setIsMinimized(!isMinimized)
  }

  return (
    <Card
      style={{
        display: 'flex',
        flexDirection: 'column',
        position: 'fixed',
        bottom: isMinimized ? '5px' : '24px',
        left: '50%',
        transform: 'translateX(-50%)',
        padding: '10px',
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        color: '#1a1a1a',
        fontSize: '14px',
        borderRadius: '8px',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
        maxWidth: isMinimized ? '150px' : '800px',
        maxHeight: '300px',
        width: '100%',
        overflow: 'hidden',
        transition: 'bottom 0.3s ease-in-out',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          width: '100%',
        }}
      >
        <button
          onClick={toggleMinimize}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: '20px',
            padding: '4px',
          }}
          type='button'
        >
          <span style={{ fontSize: '16px', fontWeight: '500' }}>Server Logs</span>
          {isMinimized ? (
            <svg
              height='20'
              style={{ marginLeft: '10px' }}
              viewBox='0 0 320 512'
              xmlns='http://www.w3.org/2000/svg'
            >
              <path d='M182.6 137.4c-12.5-12.5-32.8-12.5-45.3 0l-128 128c-9.2 9.2-11.9 22.9-6.9 34.9s16.6 19.8 29.6 19.8H288c12.9 0 24.6-7.8 29.6-19.8s2.2-25.7-6.9-34.9l-128-128z' />
            </svg>
          ) : (
            <svg
              height='20'
              style={{ marginLeft: '10px' }}
              viewBox='0 0 320 512'
              xmlns='http://www.w3.org/2000/svg'
            >
              <path d='M137.4 374.6c12.5 12.5 32.8 12.5 45.3 0l128-128c9.2-9.2 11.9-22.9 6.9-34.9s-16.6-19.8-29.6-19.8L32 192c-12.9 0-24.6 7.8-29.6 19.8s-2.2 25.7 6.9 34.9l128 128z' />
            </svg>
          )}
        </button>
      </div>
      {!isMinimized && (
        <iframe
          id='logs'
          src={iframeSrc}
          style={{ width: '100%', maxWidth: '800px', height: '260px', border: 'none' }}
          title='Console Logs'
        />
      )}
    </Card>
  )
}
