/* eslint-disable id-length */
import type {
  MessageListenerClient,
  NetClient,
} from '@dreamlab.gg/core/network'
import { createNetClient } from '@dreamlab.gg/core/network'
import { CustomMessageSchema } from './packets.js'
import type { CustomMessagePacket } from './packets.js'

export const createNetwork = (): NetClient => {
  const listeners = new Map<string, Set<MessageListenerClient>>()
  const ws = new WebSocket('wss://ws.postman-echo.com/raw') // TODO: WebSocket URL

  ws.addEventListener('message', ev => {
    if (typeof ev.data !== 'string') return

    try {
      const result = CustomMessageSchema.safeParse(JSON.parse(ev.data))
      if (!result.success) throw result.error
      const { channel, data } = result.data

      const set = listeners.get(channel)
      if (!set) return

      for (const fn of set.values()) fn(channel, data)
    } catch {
      console.warn(`malformed packet: ${ev.data}`)
    }
  })

  return createNetClient({
    sendCustomMessage(channel, data) {
      const payload: CustomMessagePacket = {
        t: 'CustomMessage',
        channel,
        data,
      }

      ws.send(JSON.stringify(payload))
    },

    addCustomMessageListener(channel, listener) {
      const set = listeners.get(channel) ?? new Set()
      set.add(listener)

      listeners.set(channel, set)
    },

    removeCustomMessageListener(channel, listener) {
      const set = listeners.get(channel) ?? new Set()
      set.delete(listener)

      listeners.set(channel, set)
    },
  })
}
