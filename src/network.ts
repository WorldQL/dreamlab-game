/* eslint-disable id-length */
import { dataManager, SpawnableDefinitionSchema } from '@dreamlab.gg/core'
import type { Game } from '@dreamlab.gg/core'
import { createNetPlayer } from '@dreamlab.gg/core/entities'
import type {
  KnownPlayerAnimation,
  NetPlayer,
  Player,
} from '@dreamlab.gg/core/entities'
import { createGear } from '@dreamlab.gg/core/managers'
import {
  isTrackedTransform,
  toRadians,
  trackedSymbol,
} from '@dreamlab.gg/core/math'
import { updateSyncedValue } from '@dreamlab.gg/core/network'
import type {
  BareNetClient,
  MessageListenerClient,
} from '@dreamlab.gg/core/network'
import { LevelSchema } from '@dreamlab.gg/core/sdk'
import {
  clone,
  createSignal,
  onChange,
  setProperty,
} from '@dreamlab.gg/core/utils'
import { jwtDecode as decodeJWT } from 'jwt-decode'
import Matter from 'matter-js'
import type { Body } from 'matter-js'
import { loadAnimations } from './animations.js'
import { createClientControlManager } from './client-phys-control.js'
import type { EditDetails } from './editor/editor.js'
import { createEditor } from './editor/editor.js'
import { PROTOCOL_VERSION } from './packets.js'
import type {
  IncomingArgsChangedPacket as ArgsChangedPacket,
  BodyInfo,
  CustomMessagePacket,
  IncomingDestroyEntityPacket as DestroyEntityPacket,
  HandshakePacket,
  HandshakeReadyPacket,
  PlayerAnimationChangePacket,
  PlayerGearChangePacket,
  PlayerInputsPacket,
  PlayerMotionPacket,
  IncomingSpawnEntityPacket as SpawnEntityPacket,
  ToClientPacket,
  ToServerPacket,
  IncomingTransformChangedPacket as TransformChangedPacket,
} from './packets.js'
import { loadScript, spawnPlayer } from './scripting.js'

export interface Params {
  readonly server: string
  readonly instance: string

  readonly token: string
  readonly playerID: string
  readonly nickname: string
}

window.addEventListener('message', ev => {
  const data = ev.data

  if (data?.fallbackUrl) {
    window.localStorage.setItem(
      '@dreamlab/worlds/fallbackUrl',
      data.fallbackUrl,
    )
    const url = new URL(data.fallbackUrl)
    window.localStorage.setItem(
      '@dreamlab/NextAPIURL',
      url.protocol + '//' + url.host,
    )
  }
})

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
    ws.addEventListener('error', () => {
      const worldDetails = localStorage.getItem('@dreamlab/worlds/fallbackUrl')
      if (worldDetails) window.location.href = worldDetails
    })
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
  const sendPacket = (_packet: ToServerPacket) => {
    const packet = JSON.stringify(_packet)

    const sendWhenOpen = async () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(packet)
      } else {
        const worldDetails = localStorage.getItem(
          '@dreamlab/worlds/fallbackUrl',
        )
        if (worldDetails) window.location.href = worldDetails
      }
    }

    ;(async () => sendWhenOpen())()
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
            const resp = LevelSchema.safeParse(packet.level)
            if (resp.success) {
              await game.spawnMany(...resp.data)
            }

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

        case 'PlayerGearSnapshot': {
          for (const info of packet.gear_info) {
            const netplayer = players.get(info.entity_id)
            if (!netplayer) continue

            netplayer.setGear(
              info.gear === null ? undefined : createGear(info.gear),
            )
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

        case 'SpawnEntity': {
          const resp = SpawnableDefinitionSchema.safeParse(packet.definition)
          if (resp.success) await game.spawn(resp.data)

          break
        }

        case 'DestroyEntity': {
          if (packet.peer_id === selfID) return

          const entity = game.lookup(packet.entity_id)
          if (entity) await game.destroy(entity)

          break
        }

        case 'TransformChanged': {
          if (packet.peer_id === selfID) return

          const entity = game.lookup(packet.entity_id)
          if (!entity) return

          const transform = entity.transform
          if (isTrackedTransform(transform)) {
            const internal = transform[trackedSymbol]
            internal.position.x = packet.position[0]
            internal.position.y = packet.position[1]
            internal.transform.rotation = packet.rotation
            internal.transform.zIndex = packet.z_index

            const bodies = game.physics
              .getBodies(entity)
              .filter(body => game.physics.isLinked(body, transform))

            for (const body of bodies) {
              Matter.Body.setPosition(body, transform.position)
              Matter.Body.setAngle(body, toRadians(transform.rotation))
            }
          }

          break
        }

        case 'ArgsChanged': {
          if (packet.peer_id === selfID) return

          const entity = game.lookup(packet.entity_id)
          if (!entity) return

          const argsTarget = onChange.target(entity.args)
          const previousArgs = clone(argsTarget)
          setProperty(argsTarget, packet.path, packet.value)

          const data = dataManager.getData(entity)
          const render = dataManager.getRenderData(entity)
          entity.onArgsUpdate?.(packet.path, previousArgs, data, render)

          break
        }

        case 'PhysicsSuspendResume': {
          if (packet.peer_id === selfID) return

          const entity = game.lookup(packet.entity_id)
          if (!entity) return

          if (packet.action === 'suspend') {
            game.physics.suspend(packet.peer_id, [entity])
          } else {
            game.physics.resume(packet.peer_id, [entity])
          }

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
      // this is an unsafe cast but we're in a try-catch so it's okay
      const packet: ToClientPacket = JSON.parse(ev.data)

      await (async () => {
        if (packet.t === 'Handshake') {
          if (packet.protocol_version !== PROTOCOL_VERSION) {
            console.warn(
              `Connecting to a mismatched version! Client: ${PROTOCOL_VERSION} Server: ${packet.protocol_version}`,
            )
            // TODO(Charlotte): Probably just disconnect at this point
          }

          if (packet.edit_mode) {
            const details: EditDetails | undefined = packet.edit_secret
              ? { secret: packet.edit_secret }
              : undefined

            const editor = createEditor(sendPacket, details)
            await game.instantiate(editor)
          }

          await loadScript(
            packet.world_script_url_base ?? undefined,
            packet.world_id,
            game,
          )

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
      })()
    } catch (error) {
      console.warn(`malformed packet: ${ev.data}`)
      console.error(error)
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

    sendPlayerGear(gear) {
      if (gear === undefined) {
        const payload: PlayerGearChangePacket = {
          t: 'PlayerGearChange',
          gear: null,
        }

        sendPacket(payload)
      } else {
        const { texture: _, ...base } = gear
        const payload: PlayerGearChangePacket = {
          t: 'PlayerGearChange',
          gear: base,
        }

        sendPacket(payload)
      }
    },

    sendEntityCreate(definition) {
      const payload: SpawnEntityPacket = {
        t: 'SpawnEntity',
        definition,
      }

      sendPacket(payload)
    },

    sendEntityDestroy(entityID) {
      const payload: DestroyEntityPacket = {
        t: 'DestroyEntity',
        entity_id: entityID,
      }

      sendPacket(payload)
    },

    sendTransformUpdate(entityID, transform) {
      const payload: TransformChangedPacket = {
        t: 'TransformChanged',
        entity_id: entityID,
        position: [transform.position.x, transform.position.y],
        rotation: transform.rotation,
        z_index: transform.zIndex,
      }

      sendPacket(payload)
    },

    sendArgsUpdate(entityID, path, value) {
      const payload: ArgsChangedPacket = {
        t: 'ArgsChanged',
        entity_id: entityID,
        path,
        value,
      }

      sendPacket(payload)
    },
  }

  return [network, ready]
}
