import type { Game } from '@dreamlab.gg/core'
import type { BodyInfo } from './packets'

export interface ClientControlManager {
  onControlGrant(entityId: string, expiry: number): void
  onControlRevoke(entityId: string): void
  isControllingEntity(entityId: string, tickNumber: number): boolean
  calculateSnapshot(clientTickNumber: number): unknown | undefined
}

// Shortcut for physics netcode feel until we get nice server-authoritative replication working
export function createClientControlManager(
  game: Game<false>,
): ClientControlManager {
  const controlledEntities = new Map<string, { expiry: number }>()

  return {
    onControlGrant(entityId, expiry) {
      const existingControl = controlledEntities.get(entityId)
      if (existingControl !== undefined) {
        controlledEntities.set(entityId, {
          expiry: Math.max(expiry, existingControl.expiry),
        })
      } else {
        controlledEntities.set(entityId, { expiry })
      }
    },

    onControlRevoke(entityId) {
      controlledEntities.delete(entityId)
    },

    isControllingEntity(entityId, tickNumber) {
      const controlInfo = controlledEntities.get(entityId)
      if (controlInfo === undefined) return false
      return controlInfo.expiry >= tickNumber
    },

    calculateSnapshot(clientTickNumber: number) {
      const snapshot: Record<string, BodyInfo[]> = {}
      let snapshotEmpty = true

      for (const [entityId, controlInfo] of controlledEntities.entries()) {
        const entity = game.lookup(entityId)
        if (entity === undefined) continue

        // forget about control after 4000ms
        if (clientTickNumber > controlInfo.expiry + 240)
          controlledEntities.delete(entityId)

        if (clientTickNumber > controlInfo.expiry) continue

        const bodyInfo = []
        const bodies = game.physics.getBodies(entity)
        for (const [bodyIndex, body] of bodies.entries()) {
          bodyInfo.push({
            bodyIndex,
            position: { x: body.position.x, y: body.position.y },
            velocity: { x: body.velocity.x, y: body.velocity.y },
            angularVelocity: body.angularVelocity,
          })
        }

        snapshot[entityId] = bodyInfo
        snapshotEmpty = false
      }

      if (snapshotEmpty) return undefined

      return snapshot
    },
  }
}
