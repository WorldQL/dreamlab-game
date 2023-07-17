/* eslint-disable id-length */
import type { Game } from '@dreamlab.gg/core'
import type {
  MessageListenerClient,
  NetClient,
} from '@dreamlab.gg/core/network'
import { createNetClient } from '@dreamlab.gg/core/network'
import type { Ref } from '@dreamlab.gg/core/utils'
import { ToClientPacketSchema } from './packets.js'
import type { CustomMessagePacket, PlayerMotionPacket } from './packets.js'

export const createNetwork = (
  gameRef: Ref<Game<false> | undefined>,
): NetClient => {
  const listeners = new Map<string, Set<MessageListenerClient>>()
  const ws = new WebSocket('wss://ws.postman-echo.com/raw') // TODO: WebSocket URL

  let selfID: string | undefined

  ws.addEventListener('message', ev => {
    if (typeof ev.data !== 'string') return

    const game = gameRef.value
    if (!game) return

    try {
      const result = ToClientPacketSchema.safeParse(JSON.parse(ev.data))
      if (!result.success) throw result.error
      const packet = result.data

      if (packet.t === 'Handshake') {
        selfID = packet.peer_id
        return
      }

      if (!selfID) return
      switch (packet.t) {
        case 'CustomMessage': {
          const { channel, data } = packet

          const set = listeners.get(channel)
          if (!set) return

          for (const fn of set.values()) fn(channel, data)
          break
        }

        default:
          console.warn(`unhandled packet: ${packet.t}`)
          break
      }
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

    sendPlayerPosition(position, velocity, flipped) {
      const payload: PlayerMotionPacket = {
        t: 'PlayerMotion',
        position: [position.x, position.y],
        velocity: [velocity.x, velocity.y],
        flipped,
      }

      ws.send(JSON.stringify(payload))
    },
  })
}
