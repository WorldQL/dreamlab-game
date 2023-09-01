/* eslint-disable id-length */
import type { Game } from '@dreamlab.gg/core'
import { createNetPlayer } from '@dreamlab.gg/core/entities'
import type {
  KnownPlayerAnimation,
  NetPlayer,
} from '@dreamlab.gg/core/entities'
import type {
  BareNetClient,
  MessageListenerClient,
} from '@dreamlab.gg/core/network'
import { createSignal } from '@dreamlab.gg/core/utils'
import Matter from 'matter-js'
import type { Body } from 'matter-js'
import { loadAnimations } from './animations.js'
import { ToClientPacketSchema } from './packets.js'
import type {
  BodyInfo,
  CustomMessagePacket,
  HandshakePacket,
  HandshakeReadyPacket,
  PlayerAnimationChangePacket,
  PlayerInputsPacket,
  PlayerMotionPacket,
  ToClientPacket,
} from './packets.js'
import { loadScript, spawnPlayer } from './scripting.js'

const PROTOCOL_VERSION = 2

let fakeLatency = Number.parseFloat(
  window.localStorage.getItem('@dreamlab/fakeLatency') ?? '0',
)
Object.defineProperty(window, 'dreamlabFakeLatency', {
  get: () => fakeLatency,
  set(v) {
    if (typeof v === 'number') fakeLatency = v
  },
})
const runAfterFakeLatency = async (f: () => Promise<void>) => {
  if (fakeLatency !== 0) {
    setTimeout(f, fakeLatency)
  } else {
    await f()
  }
}

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
  ws: WebSocket,
  game: Game<false>,
): [network: BareNetClient, ready: Promise<void>] => {
  const sendPacket = (packetObj: unknown) => {
    const packet = JSON.stringify(packetObj)
    void runAfterFakeLatency(async () => ws.send(packet))
  }

  const listeners = new Map<string, Set<MessageListenerClient>>()

  type QueuePacket = Exclude<ToClientPacket, HandshakePacket>
  const queuedPackets: QueuePacket[] = []

  let selfID: string | undefined
  const players = new Map<string, NetPlayer>()
  let lastServerTickNumber = -1
  let clientTickNumber = -1

  const updateTickNumber = (tickNumber: number) => {
    lastServerTickNumber = tickNumber
    if (clientTickNumber > lastServerTickNumber + 1) {
      console.warn('Rewinding client tick number!')
      /* TODO(Charlotte): if this turns out to be infrequent,
         we should request a resync when this happens */
    }

    clientTickNumber = tickNumber
  }

  const [sendReady, ready] = createSignal()
  const handlePacket = async (packet: QueuePacket) => {
    try {
      switch (packet.t) {
        case 'CustomMessage': {
          const { channel, data } = packet

          const set = listeners.get(channel)
          if (!set) return

          for (const fn of set.values()) fn(channel, data)
          break
        }

        case 'SpawnPlayer': {
          if (packet.peer_id === selfID) {
            // TODO: apply character ID from server packet (instead of window.location) ?
            await spawnPlayer(game)
          } else {
            const animations = await loadAnimations(packet.character_id)
            const netplayer = createNetPlayer(
              packet.peer_id,
              packet.entity_id,
              animations,
            )

            players.set(packet.entity_id, netplayer)
            await game.instantiate(netplayer)
          }

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
            netplayer.setAnimation(info.animation as KnownPlayerAnimation)
          }

          break
        }

        case 'PhysicsFullSnapshot': {
          const { entities, tickNumber } = packet.snapshot

          if (tickNumber <= lastServerTickNumber) break
          updateTickNumber(tickNumber)

          const jobs = entities.map(async entityInfo => {
            const definition = {
              ...entityInfo.definition,
              uid: entityInfo.entityId,
            }

            // the server may broadcast a PhysicsFullSnapshot at any time
            const existingEntity = game.lookup(entityInfo.entityId)
            const entity = existingEntity
              ? existingEntity
              : await game.spawn(definition)
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

          if (tickNumber <= lastServerTickNumber) break
          updateTickNumber(tickNumber)

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
          // @ts-expect-error default case
          console.warn(`unhandled packet: ${packet.t}`)
          break
      }
    } catch (error) {
      console.warn('error handling packet')
      console.log(packet)
      console.log(error)
    }
  }

  ws.addEventListener('message', async ev => {
    if (typeof ev.data !== 'string') return

    try {
      const result = ToClientPacketSchema.safeParse(JSON.parse(ev.data))
      if (!result.success) throw result.error
      const packet = result.data

      await runAfterFakeLatency(async () => {
        if (packet.t === 'Handshake') {
          if (packet.protocol_version !== PROTOCOL_VERSION) {
            console.warn(
              `Connecting to a mismatched version! Client: ${PROTOCOL_VERSION} Server: ${packet.protocol_version}`,
            )
            // TODO(Charlotte): Probably just disconnect at this point
          }

          await loadScript(packet.world_id, game)

          const payload: HandshakeReadyPacket = { t: 'HandshakeReady' }
          sendPacket(payload)

          selfID = packet.peer_id
          sendReady()

          return
        }

        if (!selfID) {
          queuedPackets.push(packet)
          return
        }

        const queue = queuedPackets.splice(0, queuedPackets.length)
        // eslint-disable-next-line no-await-in-loop
        for (const pkt of queue) await handlePacket(pkt)
        await handlePacket(packet)
      })
    } catch (error) {
      console.warn(`malformed packet: ${ev.data}`)
      console.log(error)
    }
  })

  game.addTickListener(() => {
    clientTickNumber += 1
  })

  const network: BareNetClient = {
    sendCustomMessage(channel, data) {
      const payload: CustomMessagePacket = {
        t: 'CustomMessage',
        channel,
        data,
      }

      sendPacket(payload)
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
        tick_number: clientTickNumber,
      }

      sendPacket(payload)
    },

    sendPlayerMotionInputs({ crouch, jump, walkLeft, walkRight, attack }) {
      const payload: PlayerInputsPacket = {
        t: 'PlayerInputs',
        tick_number: clientTickNumber,
        jump,
        fall_through: crouch,
        left: walkLeft,
        right: walkRight,
        attack,
      }

      sendPacket(payload)
    },

    sendPlayerAnimation(animation) {
      const payload: PlayerAnimationChangePacket = {
        t: 'PlayerAnimationChange',
        animation,
      }

      sendPacket(payload)
    },
  }

  return [network, ready]
}
