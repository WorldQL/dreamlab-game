/* eslint-disable id-length */
import { dataManager } from '@dreamlab.gg/core'
import type { Game } from '@dreamlab.gg/core'
import { createNetPlayer } from '@dreamlab.gg/core/entities'
import type {
  KnownPlayerAnimation,
  NetPlayer,
  Player,
} from '@dreamlab.gg/core/entities'
import { updateSyncedValue } from '@dreamlab.gg/core/network'
import type {
  BareNetClient,
  MessageListenerClient,
} from '@dreamlab.gg/core/network'
import { createSignal } from '@dreamlab.gg/core/utils'
import { jwtDecode as decodeJWT } from 'jwt-decode'
import Matter from 'matter-js'
import type { Body } from 'matter-js'
import { loadAnimations } from './animations.js'
import { createClientControlManager } from './client-phys-control.js'
import { PROTOCOL_VERSION, ToClientPacketSchema } from './packets.js'
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

let fakeLatency = Number.parseFloat(
  window.localStorage.getItem('@dreamlab/fakeLatency') ?? '0',
)
Object.defineProperty(window, 'dreamlabFakeLatency', {
  get: () => fakeLatency,
  set(v) {
    if (typeof v === 'number') fakeLatency = v
    window.localStorage.setItem('@dreamlab/fakeLatency', v)
  },
})
const runAfterFakeLatency = async (f: () => Promise<void>) => {
  if (fakeLatency !== 0) {
    setTimeout(f, fakeLatency)
  } else {
    await f()
  }
}

export interface Params {
  readonly server: string
  readonly instance: string

  readonly token: string
  readonly playerID: string
  readonly nickname: string
}

export const decodeParams = (): Params | undefined => {
  const url = new URL(window.location.href)

  const server = url.searchParams.get('server')
  const instance = url.searchParams.get('instance')
  const token = url.searchParams.get('token')
  if (!server || !instance || !token) return undefined

  const jwt = decodeJWT(token)
  if (jwt === null || jwt === undefined) return undefined
  if (typeof jwt !== 'object') return undefined

  if (!('player_id' in jwt)) return undefined
  if (typeof jwt.player_id !== 'string') return undefined

  if (!('nickname' in jwt)) return undefined
  if (typeof jwt.nickname !== 'string') return undefined

  return {
    server,
    instance,

    token,

    playerID: jwt.player_id,
    nickname: jwt.nickname,
  }
}

export const connect = async (
  params: Params | undefined,
): Promise<WebSocket | undefined> => {
  if (!params) return undefined

  const serverURL = new URL(params.server)
  serverURL.pathname = `/api/v1/connect/${params.instance}`
  serverURL.searchParams.set('instance', params.instance)
  serverURL.searchParams.set('token', params.token)

  return new Promise<WebSocket | undefined>(resolve => {
    const ws = new WebSocket(serverURL.toString())
    resolve(ws)

    // ws.addEventListener('open', () => resolve(ws))
    // ws.addEventListener('error', () => resolve(undefined))
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
  let localPlayer: Player | undefined
  let clientTickNumber = 0

  const clientControl = createClientControlManager(game)

  const runPhysicsCatchUp = (tickNumber: number, entityIds: string[]) => {
    if (tickNumber === -1 || tickNumber >= clientTickNumber) return

    const now = performance.now() / 1_000

    for (let i = tickNumber; i < clientTickNumber; i++) {
      for (const id of entityIds) {
        const entity = game.lookup(id)
        if (entity === undefined) continue

        if (typeof entity.onPhysicsStep === 'function') {
          const entityData = dataManager.getData(entity)
          const ticksRemaining = clientTickNumber - i - 1
          entity.onPhysicsStep(
            {
              delta: 1 / 60,
              time: now - (1 / 60) * ticksRemaining,
            },
            entityData,
          )
        }

        const bodies = game.physics.getBodies(entity)
        for (const body of bodies) Matter.Body.update(body, 1_000 / 60, 1, 1)
      }
    }
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
            localPlayer = await spawnPlayer(game)
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
          const tickNumber = packet.lastClientTickNumber
          const { entities } = packet.snapshot
          const affectedEntities: string[] = []

          const jobs = entities.map(async entityInfo => {
            const definition = {
              ...entityInfo.definition,
              uid: entityInfo.entityId,
            }

            // the server may broadcast a PhysicsFullSnapshot at any time,
            // so entities can already be existing in the world
            const existingEntity = game.lookup(entityInfo.entityId)

            // we can skip any incoming physics snapshot for an entity we are currently controlling
            if (
              existingEntity &&
              clientControl.isControllingEntity(entityInfo.entityId, tickNumber)
            )
              return

            const entity = existingEntity
              ? existingEntity
              : await game.spawn(definition)
            if (entity === undefined) return
            affectedEntities.push(entity.uid)

            const bodies = game.physics.getBodies(entity)
            updateBodies(bodies, entityInfo.bodyInfo)
          })

          await Promise.all(jobs)
          runPhysicsCatchUp(tickNumber, affectedEntities)
          break
        }

        case 'PhysicsDeltaSnapshot': {
          const tickNumber = packet.lastClientTickNumber
          const { bodyUpdates, destroyedEntities, newEntities } =
            packet.snapshot

          const affectedEntities: string[] = []

          const spawnJobs = newEntities.map(async entityInfo => {
            const definition = {
              ...entityInfo.definition,
              uid: entityInfo.entityId,
            }

            const entity = await game.spawn(definition)
            if (entity === undefined) return
            affectedEntities.push(entity.uid)

            const bodies = game.physics.getBodies(entity)
            updateBodies(bodies, entityInfo.bodyInfo)
          })

          const updateJobs = bodyUpdates.map(async entityInfo => {
            const entity = game.lookup(entityInfo.entityId)
            if (entity === undefined) return
            if (
              clientControl.isControllingEntity(entityInfo.entityId, tickNumber)
            )
              return

            affectedEntities.push(entity.uid)
            const bodies = game.physics.getBodies(entity)
            updateBodies(bodies, entityInfo.bodyInfo)
          })

          const destroyJobs = destroyedEntities.map(async uid => {
            const entity = game.lookup(uid)
            if (entity) await game.destroy(entity)
          })

          await Promise.all([...spawnJobs, ...updateJobs, ...destroyJobs])
          runPhysicsCatchUp(tickNumber, affectedEntities)

          break
        }

        case 'PhysicsGrantObjectControl': {
          clientControl.onControlGrant(packet.entity_id, packet.expiry_tick)
          break
        }

        case 'PhysicsRevokeObjectControl': {
          clientControl.onControlRevoke(packet.entity_id)
          break
        }

        case 'UpdateSyncedValue': {
          const { entity_id, key, value } = packet
          updateSyncedValue(game, entity_id, key, value)

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

  game.events.common.addListener('onPhysicsStep', () => {
    const snapshot = clientControl.calculateSnapshot(clientTickNumber)
    if (snapshot !== undefined) {
      sendPacket({
        t: 'PhysicsControlledObjectsSnapshot',
        tick_number: clientTickNumber,
        snapshot,
      })
    }

    // for now, we just request control over every replicated entity close to us:
    if (localPlayer !== undefined) {
      const entities = game.queryTags(
        'fn',
        tags =>
          tags.includes('net/replicated') &&
          !tags.includes('net/server-authoritative'),
      )
      for (const entity of entities) {
        if (
          clientControl.isControllingEntity(entity.uid, clientTickNumber + 30)
        )
          continue

        const bodies = game.physics.getBodies(entity)
        for (const body of bodies) {
          if (body.isStatic) continue

          // TODO(Charlotte): better bounds distance check. this does not account for size rn
          const distanceSq = Matter.Vector.magnitudeSquared(
            Matter.Vector.sub(body.position, localPlayer.position),
          )

          if (distanceSq < 400 * 400) {
            sendPacket({
              t: 'PhysicsRequestObjectControl',
              entity_id: entity.uid,
            })
          }
        }
      }
    }

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
