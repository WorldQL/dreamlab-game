/* eslint-disable id-length */
import type { Game } from '@dreamlab.gg/core'
import { createNetPlayer } from '@dreamlab.gg/core/entities'
import type { NetPlayer, PlayerAnimation } from '@dreamlab.gg/core/entities'
import { createNetClient } from '@dreamlab.gg/core/network'
import type {
  MessageListenerClient,
  NetClient,
} from '@dreamlab.gg/core/network'
import type { Ref } from '@dreamlab.gg/core/utils'
import Matter from 'matter-js'
import type { Body } from 'matter-js'
import { loadAnimations } from './animations.js'
import { ToClientPacketSchema } from './packets.js'
import type {
  BodyInfo,
  CustomMessagePacket,
  PlayerAnimationChangePacket,
  PlayerMotionPacket,
} from './packets.js'

export const connect = async (): Promise<WebSocket | undefined> => {
  const url = new URL(window.location.href)

  const base = import.meta.env.VITE_WEBSOCKET_BASE
  const instance = url.searchParams.get('instance')
  const nickname = url.searchParams.get('nickname')

  if (!base || !instance || !nickname) return undefined

  const serverURL = new URL(base)
  serverURL.pathname = '/api/connect'
  serverURL.searchParams.set('instance', instance)
  serverURL.searchParams.set('nickname', nickname)

  return new Promise<WebSocket | undefined>(resolve => {
    const ws = new WebSocket(serverURL.toString())

    ws.addEventListener('open', () => resolve(ws))
    ws.addEventListener('error', () => resolve(undefined))
  })
}

const updateBodies = (bodies: Body[], bodyInfo: BodyInfo[]) => {
  for (const [idx, body] of bodies.entries()) {
    const info = bodyInfo[idx]

    Matter.Body.setPosition(body, info.position)
    Matter.Body.setVelocity(body, info.velocity)
    Matter.Body.setAngularVelocity(body, info.angularVelocity)
  }
}

export const createNetwork = (
  ws: WebSocket | undefined,
  gameRef: Ref<Game<false> | undefined>,
): NetClient => {
  const listeners = new Map<string, Set<MessageListenerClient>>()

  let selfID: string | undefined
  const players = new Map<string, NetPlayer>()
  let lastTickNumber = -1

  ws?.addEventListener('message', async ev => {
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
          const animations = await loadAnimations(undefined)
          const netplayer = createNetPlayer(packet.entity_id, animations)

          players.set(packet.entity_id, netplayer)
          await game.instantiate(netplayer)

          break
        }

        case 'DespawnPlayer': {
          if (packet.peer_id === selfID) break
          const netplayer = players.get(packet.entity_id)

          if (netplayer) {
            players.delete(packet.entity_id)
            await game.destroy(netplayer)
          }

          break
        }

        case 'PlayerMotionSnapshot': {
          for (const info of packet.motion_info) {
            const netplayer = players.get(info.entity_id)
            if (!netplayer) continue

            netplayer.setPosition(info.position)
            netplayer.setVelocity(info.velocity)
            netplayer.setFlipped(info.flipped)
          }

          break
        }

        case 'PlayerAnimationSnapshot': {
          for (const info of packet.animation_info) {
            const netplayer = players.get(info.entity_id)
            if (!netplayer) continue

            // TODO: Maybe validate this string
            netplayer.setAnimation(info.animation as PlayerAnimation)
          }

          break
        }

        case 'PhysicsFullSnapshot': {
          const { entities, tickNumber } = packet.snapshot

          if (tickNumber <= lastTickNumber) break
          lastTickNumber = tickNumber

          const jobs = entities.map(async entityInfo => {
            const definition = {
              ...entityInfo.definition,
              uid: entityInfo.entityId,
            }

            const entity = await game.spawn(definition)
            if (entity === undefined) return

            const bodies = game.physics.getBodies(entity)
            updateBodies(bodies, entityInfo.bodyInfo)
          })

          await Promise.all(jobs)
          break
        }

        case 'PhysicsDeltaSnapshot': {
          const { bodyUpdates, destroyedEntities, newEntities, tickNumber } =
            packet.snapshot

          if (tickNumber <= lastTickNumber) break
          lastTickNumber = tickNumber

          const spawnJobs = newEntities.map(async entityInfo => {
            const definition = {
              ...entityInfo.definition,
              uid: entityInfo.entityId,
            }

            const entity = await game.spawn(definition)
            if (entity === undefined) return

            const bodies = game.physics.getBodies(entity)
            updateBodies(bodies, entityInfo.bodyInfo)
          })

          const updateJobs = bodyUpdates.map(async entityInfo => {
            const entity = game.lookup(entityInfo.entityId)
            if (entity === undefined) return

            const bodies = game.physics.getBodies(entity)
            updateBodies(bodies, entityInfo.bodyInfo)
          })

          const destroyJobs = destroyedEntities.map(async uid => {
            const entity = game.lookup(uid)
            if (entity) await game.destroy(entity)
          })

          await Promise.all([...spawnJobs, ...updateJobs, ...destroyJobs])
          break
        }

        default:
          // console.warn(`unhandled packet: ${packet.t}`)
          break
      }
    } catch (error) {
      console.warn(`malformed packet: ${ev.data}`)
      console.log({ error })
    }
  })

  return createNetClient({
    sendCustomMessage(channel, data) {
      const payload: CustomMessagePacket = {
        t: 'CustomMessage',
        channel,
        data,
      }

      ws?.send(JSON.stringify(payload))
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

      ws?.send(JSON.stringify(payload))
    },

    sendPlayerAnimation(animation) {
      const payload: PlayerAnimationChangePacket = {
        t: 'PlayerAnimationChange',
        animation,
      }

      ws?.send(JSON.stringify(payload))
    },
  })
}
