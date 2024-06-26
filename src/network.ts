/* eslint-disable id-length */
import { SpawnableDefinitionSchema } from '@dreamlab.gg/core'
import type { Game } from '@dreamlab.gg/core'
import { createGear } from '@dreamlab.gg/core/dist/managers'
import { NetPlayer } from '@dreamlab.gg/core/entities'
import type { KnownAnimation } from '@dreamlab.gg/core/entities'
import { isTrackedTransform, trackedSymbol } from '@dreamlab.gg/core/math'
import { updateSyncedValue } from '@dreamlab.gg/core/network'
import type { BareNetClient, MessageListenerClient } from '@dreamlab.gg/core/network'
import { LevelSchema } from '@dreamlab.gg/core/sdk'
import {
  clone,
  createSignal,
  deferUntilPlayer,
  onChange,
  setProperty,
} from '@dreamlab.gg/core/utils'
import Matter from 'matter-js'
import type { Body } from 'matter-js'
import { createClientControlManager } from './client-phys-control.js'
import type { EditDetails } from './editor/editor'
import { Editor } from './editor/editor'
import { PROTOCOL_VERSION } from './packets.js'
import type {
  BodyInfo,
  CustomMessagePacket,
  HandshakePacket,
  HandshakeReadyPacket,
  ToClientPacket,
  ToServerPacket,
  UpdateSyncedValuePacket,
} from './packets.js'
import type { ConnectionDetails, PlayerInfo } from './params.js'
import { loadScript, spawnPlayer } from './scripting.js'

window.addEventListener('message', ev => {
  const data = ev.data

  if (data?.fallbackUrl) {
    window.localStorage.setItem('@dreamlab/worlds/fallbackUrl', data.fallbackUrl)
    const url = new URL(data.fallbackUrl)
    window.localStorage.setItem('@dreamlab/NextAPIURL', url.protocol + '//' + url.host)
  }
})

export const connect = async (
  { server, instance }: ConnectionDetails,
  { token, characterId }: PlayerInfo,
): Promise<WebSocket> => {
  const serverUrl = new URL(server)
  serverUrl.pathname +=
    serverUrl.pathname === '/' ? `api/v1/connect/${instance}` : `/api/v1/connect/${instance}`

  serverUrl.searchParams.set('instance', instance)
  serverUrl.searchParams.set('token', token)

  if (characterId) serverUrl.searchParams.set('character_id', characterId)

  return new Promise<WebSocket>(resolve => {
    const ws = new WebSocket(serverUrl.toString())
    resolve(ws)

    ws.addEventListener('open', () => {
      console.log('WebSocket connection opened')
      window.parent.postMessage('connected', '*')
    })

    ws.addEventListener('error', () => {
      console.log('Got error in websocket event listener')
      setTimeout(() => {
        window.parent.postMessage('reload', '*')
      }, 1_000)
    })
  })
}

const updateBodies = (bodies: Body[], bodyInfo: BodyInfo[]) => {
  for (const [idx, body] of bodies.entries()) {
    const info = bodyInfo[idx]

    Matter.Body.setPosition(body, info.position)
    Matter.Body.setVelocity(body, info.velocity)
    Matter.Body.setAngularVelocity(body, info.angularVelocity)
    Matter.Body.setAngle(body, info.angle)
    Matter.Body.scale(body, 1, 1)
  }
}

export const createNetwork = ({
  server,
  instance,
  ws,
  game,
}: {
  readonly server: string
  readonly instance: string
  readonly ws: WebSocket
  readonly game: Game<false>
}): [
  network: BareNetClient,
  sendPacket: (packet: ToServerPacket) => void,
  ready: Promise<void>,
] => {
  let didSetReloadTimeout = false

  const sendPacket = (_packet: ToServerPacket) => {
    const packet = JSON.stringify(_packet, (_key, value) =>
      value instanceof Set ? [...value] : value,
    )

    const sendWhenOpen = async () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(packet)
      } else {
        const webSocketStates: { [key: number]: string } = {
          0: 'CONNECTING',
          1: 'OPEN',
          2: 'CLOSING',
          3: 'CLOSED',
        }
        if (!didSetReloadTimeout) {
          console.log(
            'Got websocket state ' +
              webSocketStates[ws.readyState] +
              ' and am going to reload in 1 second.',
          )
          setTimeout(() => {
            window.location.reload()
          }, 1_000)
          didSetReloadTimeout = true
        }
        /*
        const worldDetails = localStorage.getItem(
          '@dreamlab/worlds/fallbackUrl',
        )
        if (worldDetails) window.location.href = worldDetails
        */
      }
    }

    // TODO: Why are these IIFEs everywhere what??
    ;(async () => sendWhenOpen())()
  }

  const listeners = new Map<string, Set<MessageListenerClient>>()

  type QueuePacket = Exclude<ToClientPacket, HandshakePacket>
  const queuedPackets: QueuePacket[] = []

  let selfID: string | undefined
  const players = new Map<string, NetPlayer>()
  // let localPlayer: Player | undefined
  const clientTickNumber = 0

  // If we dont recieve a handshake for 5s, reload and try again
  setTimeout(() => {
    if (selfID === undefined) window.location.reload()
  }, 5_000)

  deferUntilPlayer(player => {
    player.events.addListener('onMove', (position, velocity, flipped) => {
      window.sendPacket?.({
        t: 'PlayerMotion',
        position: [position.x, position.y],
        velocity: [velocity.x, velocity.y],
        flipped,
        tick_number: clientTickNumber,
      })
    })

    player.events.addListener('onInput', ({ walkLeft, walkRight, jump, crouch, attack, jog }) => {
      window.sendPacket?.({
        t: 'PlayerInputs',
        left: walkLeft,
        right: walkRight,
        jump,
        fall_through: crouch,
        attack,
        jog,
        tick_number: clientTickNumber,
      })
    })

    // TODO: Character ID change packet

    player.events.addListener('onCharacterIdChange', characterId => {
      window.sendPacket?.({ t: 'PlayerCharacterIdChange', character_id: characterId ?? null })
    })

    player.events.addListener('onAnimationChanged', animation => {
      window.sendPacket?.({ t: 'PlayerAnimationChange', animation })
    })

    player.events.addListener('onGearChanged', gear => {
      // Serialize the gear object to exclude the texture property
      if (gear) {
        const serializedGear = {
          displayName: gear.displayName,
          animationName: gear.animationName,
          textureURL: gear.textureURL,
          anchor: gear.anchor,
          rotation: gear.rotation,
          bone: gear.bone,
          speedMultiplier: gear.speedMultiplier,
        }
        window.sendPacket?.({ t: 'PlayerGearChange', gear: serializedGear })
      }
    })
  })

  const clientControl = createClientControlManager(game)

  const runPhysicsCatchUp = (tickNumber: number, entityIds: Set<string>) => {
    if (tickNumber === -1 || tickNumber >= clientTickNumber) return

    const now = performance.now() / 1_000

    for (let i = tickNumber; i < clientTickNumber; i++) {
      for (const id of entityIds) {
        const entity = game.lookup(id)
        if (entity === undefined) continue

        if (typeof entity.onPhysicsStep === 'function') {
          const ticksRemaining = clientTickNumber - i - 1
          entity.onPhysicsStep({
            delta: 1 / 60,
            time: now - (1 / 60) * ticksRemaining,
          })
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
          for (const { channel, data } of packet.messages) {
            const set = listeners.get(channel)
            if (!set) continue

            // eslint-disable-next-line no-await-in-loop
            for (const fn of set.values()) await fn(channel, data)
          }

          break
        }

        case 'SpawnPlayer': {
          if (packet.connection_id === selfID) {
            const resp = LevelSchema.safeParse(packet.level)
            if (resp.success) {
              game.spawnMany(...resp.data)
            }

            await spawnPlayer(game)
          } else {
            const netplayer = new NetPlayer(
              packet.connection_id,
              packet.player_id,
              packet.entity_id,
              packet.character_id,
              packet.nickname,
            )

            players.set(packet.entity_id, netplayer)
            game.instantiate(netplayer)
          }

          break
        }

        case 'DespawnPlayer': {
          if (packet.connection_id === selfID) break
          const netplayer = players.get(packet.entity_id)

          if (netplayer) {
            players.delete(packet.entity_id)
            game.destroy(netplayer)
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

        case 'PlayerCharacterIdSnapshot': {
          for (const info of packet.character_id_info) {
            const netplayer = players.get(info.entity_id)
            if (!netplayer) continue

            netplayer.characterId = info.character_id ?? undefined
          }

          break
        }

        case 'PlayerAnimationSnapshot': {
          for (const info of packet.animation_info) {
            const netplayer = players.get(info.entity_id)
            if (!netplayer) continue

            // TODO: Maybe validate this string
            netplayer.setAnimation(info.animation as KnownAnimation)
          }

          break
        }

        case 'PlayerGearSnapshot': {
          for (const info of packet.gear_info) {
            const netplayer = players.get(info.entity_id)
            if (!netplayer) continue

            netplayer.gear = info.gear === null ? undefined : createGear(info.gear)
          }

          break
        }

        case 'PhysicsFullSnapshot': {
          const tickNumber = packet.lastClientTickNumber
          const { entities } = packet.snapshot
          const affectedEntities = new Set<string>()

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

            const entity = existingEntity ? existingEntity : game.spawn(definition)
            if (entity === undefined) return
            affectedEntities.add(entity.uid)

            const bodies = game.physics.getBodies(entity)
            updateBodies(bodies, entityInfo.bodyInfo)
          })

          for (const e of game.queryTags(
            'fn',
            t => t.includes('net/replicated') && !t.includes('net/replicated/ignore'),
          )) {
            if (!affectedEntities.has(e.uid)) {
              game.destroy(e)
            }
          }

          await Promise.all(jobs)
          runPhysicsCatchUp(tickNumber, affectedEntities)
          break
        }

        case 'PhysicsDeltaSnapshot': {
          const tickNumber = packet.lastClientTickNumber
          const { bodyUpdates, destroyedEntities, newEntities } = packet.snapshot

          const affectedEntities = new Set<string>()

          const spawnJobs = newEntities.map(async entityInfo => {
            if (game.lookup(entityInfo.entityId) !== undefined) return

            const definition = {
              ...entityInfo.definition,
              uid: entityInfo.entityId,
            }

            const entity = game.spawn(definition)
            if (entity === undefined) return
            affectedEntities.add(entity.uid)

            const bodies = game.physics.getBodies(entity)
            updateBodies(bodies, entityInfo.bodyInfo)
          })

          const updateJobs = bodyUpdates.map(async entityInfo => {
            const entity = game.lookup(entityInfo.entityId)
            if (entity === undefined) return
            if (clientControl.isControllingEntity(entityInfo.entityId, tickNumber)) return
            if (entity.tags.includes('net/replicated/ignore')) return

            affectedEntities.add(entity.uid)
            const bodies = game.physics.getBodies(entity)
            updateBodies(bodies, entityInfo.bodyInfo)
          })

          const destroyJobs = destroyedEntities.map(async uid => {
            const entity = game.lookup(uid)
            if (entity) game.destroy(entity)
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
          for (const { entity_id, key, value } of packet.values) {
            updateSyncedValue(game, entity_id, key, value)
          }

          break
        }

        // TODO: fix entity already spawned bug when using history undo/redo
        case 'SpawnEntity': {
          const resp = SpawnableDefinitionSchema.safeParse(packet.definition)
          if (resp.success) game.spawn(resp.data)

          break
        }

        case 'DestroyEntity': {
          if (packet.connection_id === selfID) return

          const entity = game.lookup(packet.entity_id)
          if (entity) game.destroy(entity)

          break
        }

        case 'TransformChanged': {
          if (packet.connection_id === selfID) return

          const entity = game.lookup(packet.entity_id)
          if (!entity) return

          const transform = entity.transform
          if (isTrackedTransform(transform)) {
            const internal = transform[trackedSymbol]
            internal.position.x = packet.position[0]
            internal.position.y = packet.position[1]
            internal.transform.rotation = packet.rotation
            internal.transform.zIndex = packet.z_index
            internal.sync()

            // const bodies = game.physics
            //   .getBodies(entity)
            //   .filter(body => game.physics.isLinked(body, transform))

            // for (const body of bodies) {
            //   Matter.Body.setPosition(body, transform.position)
            //   Matter.Body.setAngle(body, toRadians(transform.rotation))
            // }
          }

          break
        }

        case 'ArgsChanged': {
          if (packet.connection_id === selfID) return

          const entity = game.lookup(packet.entity_id)
          if (!entity) return

          const argsTarget = onChange.target(entity.args)
          const previousArgs = clone(argsTarget)
          setProperty(argsTarget, packet.path, packet.value)

          entity.onArgsUpdate?.(packet.path, previousArgs)
          game.events.common.emit('onArgsChanged', entity, packet.path, packet.value, true)

          break
        }

        case 'LabelChanged': {
          if (packet.connection_id === selfID) return

          const entity = game.lookup(packet.entity_id)
          if (!entity) return

          const definition = onChange.target(entity.definition)
          definition.label = packet.label
          game.events.common.emit('onDefinitionChanged', entity)

          break
        }

        case 'TagsChanged': {
          if (packet.connection_id === selfID) return

          const entity = game.lookup(packet.entity_id)
          if (!entity) return

          const definition = onChange.target(entity.definition)
          definition.tags = packet.tags

          break
        }

        case 'PhysicsSuspendResume': {
          if (packet.connection_id === selfID) return

          const entity = game.lookup(packet.entity_id)
          if (!entity) return

          if (packet.action === 'suspend') {
            game.physics.suspend(packet.connection_id, [entity])
          } else {
            game.physics.resume(packet.connection_id, [entity])
          }

          break
        }

        case 'Disconnecting': {
          if (packet.reason === 'Restarting') {
            // this allows the commit request to not be cancelled. the server restarts too fast after the level save
            // TODO: Do this in a more elegant way where we actually wait for the commit request to go thru
            setTimeout(() => {
              window.location.reload()
            }, 1_000)
          }

          // TODO: redirect back to play page if we're shutting down for good?

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
      console.error(error)
    }
  }

  ws.addEventListener('message', async ev => {
    if (typeof ev.data !== 'string') return

    try {
      // this is an unsafe cast but we're in a try-catch so it's okay
      const packet: ToClientPacket = JSON.parse(ev.data)

      // TODO: What the heck is this IIFE doing here??????
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
              ? {
                  secret: packet.edit_secret,
                  instance,
                  server,
                }
              : undefined

            window.parent.postMessage(`edit_secret:${packet.edit_secret}`, '*')

            if (!game.debug.value) game.debug.toggle()
            const editor = new Editor(sendPacket, details)
            game.instantiate(editor)
          }

          // @ts-expect-error global variable
          globalThis.dreamlab_world_script_url_base = packet.world_script_url_base

          await loadScript(
            packet.world_script_url_base ?? undefined,
            packet.world_id,
            packet.world_variant,
            game,
          )

          const payload: HandshakeReadyPacket = { t: 'HandshakeReady' }
          sendPacket(payload)

          selfID = packet.connection_id
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

  const customMessageQueue: CustomMessagePacket['messages'] = []
  game.events.common.addListener('onPhysicsStep', () => {
    if (ws.readyState !== WebSocket.OPEN) return

    const messages = customMessageQueue.splice(0, customMessageQueue.length)
    if (messages.length === 0) return

    const payload: CustomMessagePacket = {
      t: 'CustomMessage',
      messages,
    }

    sendPacket(payload)
  })

  const network: BareNetClient = {
    get connectionId(): string {
      if (!selfID) throw new Error('network not initialized yet')

      return selfID
    },

    sendCustomMessage(channel, data) {
      customMessageQueue.push({ channel, data })
    },

    updateSyncedValue(entityId, key, value) {
      // TODO: Batch this
      const payload: UpdateSyncedValuePacket = {
        t: 'UpdateSyncedValue',
        values: [{ entity_id: entityId, key, value }],
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
  }

  return [network, sendPacket, ready]
}
