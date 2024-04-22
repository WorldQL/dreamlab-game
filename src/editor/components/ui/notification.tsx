import type { FC } from 'react'

interface NotificationProps {
  readonly message: string
}

export const Notification: FC<NotificationProps> = ({ message }) => {
  if (!message) return null

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        backgroundColor: '#4CAF50',
        color: 'white',
        padding: '10px',
        borderRadius: '5px',
        boxShadow: '0px 2px 5px rgba(0, 0, 0, 0.2)',
        zIndex: 1_000,
        transition: 'all 0.5s ease',
      }}
    >
      {message}
    </div>
  )
}
