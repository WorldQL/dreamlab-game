export type LogListener = (date: Date, message: string) => void

export interface LogStreamingClient {
  get history(): [Date, string][]
  addListener(listener: LogListener): void
  removeListener(listener: LogListener): void
}

export const createLogStreamingClient = (server: string, instance: string): LogStreamingClient => {
  const listeners: LogListener[] = []
  const history: [Date, string][] = []

  const url = new URL(server)
  url.pathname = `/api/v1/log-stream/${instance}`
  const socket = new WebSocket(url)

  socket.addEventListener('open', _ => {
    socket.send(JSON.stringify({ t: 'FetchHistory' }))
  })

  socket.addEventListener('message', event => {
    const data = event.data
    if (typeof data !== 'string') {
      return
    }

    const packet = JSON.parse(data)
    switch (packet.t) {
      case 'LogEntry': {
        const date = new Date((packet.timestamp as number) * 1_000)
        const message = packet.message as string
        history.push([date, message])
        for (const li of listeners) li(date, message)

        break
      }

      case 'HistoryDump': {
        const entries = packet.entries as {
          timestamp: number
          message: string
        }[]

        for (const entry of entries) {
          const date = new Date(entry.timestamp * 1_000)
          history.push([date, entry.message])
          for (const li of listeners) li(date, entry.message)
        }

        break
      }

      default:
        console.warn('Dropping unknown log streaming packet: ' + packet.t)
    }
  })

  return {
    get history() {
      return history
    },
    addListener(listener) {
      listeners.push(listener)
    },
    removeListener(listener) {
      const index = listeners.indexOf(listener)
      if (index !== -1) listeners.splice(index, 1)
    },
  }
}
