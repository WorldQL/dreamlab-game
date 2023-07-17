/* eslint-disable id-length */
import type { Game } from '@dreamlab.gg/core'
import { createNetPlayer } from '@dreamlab.gg/core/entities'
import type { NetPlayer } from '@dreamlab.gg/core/entities'
import type {
  MessageListenerClient,
  NetClient,
} from '@dreamlab.gg/core/network'
import { createNetClient } from '@dreamlab.gg/core/network'
import type { Ref } from '@dreamlab.gg/core/utils'
import { loadAnimations } from './animations.js'
import { ToClientPacketSchema } from './packets.js'
import type { CustomMessagePacket, PlayerMotionPacket } from './packets.js'

export const createNetwork = (
  gameRef: Ref<Game<false> | undefined>,
): NetClient => {
  const listeners = new Map<string, Set<MessageListenerClient>>()
  const ws = new WebSocket('wss://ws.postman-echo.com/raw') // TODO: WebSocket URL

  let selfID: string | undefined
  const players = new Map<string, NetPlayer>()

  ws.addEventListener('message', async ev => {
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

        case 'SpawnPlayer': {
          if (packet.peer_id === selfID) break

          // TODO: Load correct animations
          const animations = await loadAnimations()
          const netplayer = createNetPlayer(packet.entity_id, animations)

          players.set(packet.peer_id, netplayer)
          await game.instantiate(netplayer)

          break
        }

        case 'DespawnPlayer': {
          if (packet.peer_id === selfID) break
          const netplayer = players.get(packet.peer_id)

          if (netplayer) {
            players.delete(packet.peer_id)
            await game.destroy(netplayer)
          }

          break
        }

        case 'PlayerMotionSnapshot': {
          console.log(packet)

          // TODO
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
