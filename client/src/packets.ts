/* eslint-disable id-length */
import { SpawnableDefinitionSchema } from '@dreamlab.gg/core'
import { z } from 'zod'

export const PROTOCOL_VERSION = 4

const TupleVectorSchema = z.tuple([z.number(), z.number()])
const ObjectVectorSchema = z.object({ x: z.number(), y: z.number() })

export type HandshakePacket = z.infer<typeof HandshakeSchema>
export const HandshakeSchema = z.object({
  t: z.literal('Handshake'),

  protocol_version: z.number(),
  peer_id: z.string(),
  world_id: z.string(),
})

export type HandshakeReadyPacket = z.infer<typeof HandshakeReadySchema>
export const HandshakeReadySchema = z.object({
  t: z.literal('HandshakeReady'),
})

export type SpawnPlayerPacket = z.infer<typeof SpawnPlayerSchema>
export const SpawnPlayerSchema = z.object({
  t: z.literal('SpawnPlayer'),

  peer_id: z.string(),
  entity_id: z.string(),
  character_id: z.optional(z.string()),
  position: TupleVectorSchema,
})

export type DespawnPlayerPacket = z.infer<typeof DespawnPlayerSchema>
export const DespawnPlayerSchema = z.object({
  t: z.literal('DespawnPlayer'),

  peer_id: z.string(),
  entity_id: z.string(),
})

export type PlayerMotionInfo = z.infer<typeof PlayerMotionInfoSchema>
export const PlayerMotionInfoSchema = z.object({
  entity_id: z.string(),
  position: TupleVectorSchema,
  velocity: TupleVectorSchema,
  flipped: z.boolean(),
})

export type PlayerMotionSnapshotPacket = z.infer<
  typeof PlayerMotionSnapshotSchema
>
export const PlayerMotionSnapshotSchema = z.object({
  t: z.literal('PlayerMotionSnapshot'),

  motion_info: PlayerMotionInfoSchema.array(),
})

export type PlayerAnimationInfo = z.infer<typeof PlayerAnimationInfoSchema>
export const PlayerAnimationInfoSchema = z.object({
  entity_id: z.string(),
  animation: z.string(),
})

export type PlayerAnimationSnapshotPacket = z.infer<
  typeof PlayerAnimationSnapshotSchema
>
export const PlayerAnimationSnapshotSchema = z.object({
  t: z.literal('PlayerAnimationSnapshot'),

  animation_info: PlayerAnimationInfoSchema.array(),
})

export type CustomMessagePacket = z.infer<typeof CustomMessageSchema>
export const CustomMessageSchema = z.object({
  t: z.literal('CustomMessage'),

  channel: z.string(),
  data: z.record(z.string(), z.unknown()),
})

export type ChatMessagePacket = z.infer<typeof ChatMessageSchema>
export const ChatMessageSchema = z.object({
  t: z.literal('ChatMessage'),

  from_id: z.string(),
  from_nick: z.string(),
  message: z.string(),
})

export type PlayerMotionPacket = z.infer<typeof PlayerMotionSchema>
export const PlayerMotionSchema = z.object({
  t: z.literal('PlayerMotion'),

  position: TupleVectorSchema,
  velocity: TupleVectorSchema,
  flipped: z.boolean(),
  tick_number: z.number().int(),
})

export type PlayerInputsPacket = z.infer<typeof PlayerInputsPacketSchema>
export const PlayerInputsPacketSchema = z.object({
  t: z.literal('PlayerInputs'),

  tick_number: z.number().int(),
  jump: z.boolean(),
  fall_through: z.boolean(),
  left: z.boolean(),
  right: z.boolean(),
  attack: z.boolean(),
})

export type PlayerAnimationChangePacket = z.infer<
  typeof PlayerAnimationChangeSchema
>
export const PlayerAnimationChangeSchema = z.object({
  t: z.literal('PlayerAnimationChange'),

  animation: z.string(),
})

export type BodyInfo = z.infer<typeof BodyInfoSchema>
export const BodyInfoSchema = z.object({
  bodyIndex: z.number(),
  position: ObjectVectorSchema,
  velocity: ObjectVectorSchema,
  angularVelocity: z.number(),
})

export type EntitySnapshot = z.infer<typeof EntitySnapshotSchema>
export const EntitySnapshotSchema = z.object({
  entityId: z.string(),
  definition: SpawnableDefinitionSchema,
  bodyInfo: BodyInfoSchema.array(),
})

export type PhysicsFullSnapshotPacket = z.infer<
  typeof PhysicsFullSnapshotSchema
>
export const PhysicsFullSnapshotSchema = z.object({
  t: z.literal('PhysicsFullSnapshot'),
  lastClientTickNumber: z.number(),

  snapshot: z.object({
    tickNumber: z.number(),
    entities: EntitySnapshotSchema.array(),
  }),
})

export type PhysicsDeltaSnapshotPacket = z.infer<
  typeof PhysicsFullSnapshotSchema
>
export const PhysicsDeltaSnapshotSchema = z.object({
  t: z.literal('PhysicsDeltaSnapshot'),
  lastClientTickNumber: z.number(),

  snapshot: z.object({
    tickNumber: z.number(),
    newEntities: EntitySnapshotSchema.array(),
    bodyUpdates: EntitySnapshotSchema.omit({ definition: true }).array(),
    destroyedEntities: z.string().array(),
  }),
})

export type PhysicsGrantObjectControlPacket = z.infer<
  typeof PhysicsGrantObjectControlSchema
>
export const PhysicsGrantObjectControlSchema = z.object({
  t: z.literal('PhysicsGrantObjectControl'),
  entity_id: z.string(),
  expiry_tick: z.number(),
})

export type PhysicsRevokeObjectControlPacket = z.infer<
  typeof PhysicsRevokeObjectControlSchema
>
export const PhysicsRevokeObjectControlSchema = z.object({
  t: z.literal('PhysicsRevokeObjectControl'),
  entity_id: z.string(),
})

export type UpdateSyncedValuePacket = z.infer<typeof UpdateSyncedValueSchema>
export const UpdateSyncedValueSchema = z.object({
  t: z.literal('UpdateSyncedValue'),
  entity_id: z.string(),
  key: z.string(),
  value: z.unknown(),
})

export type ToClientPacket = z.infer<typeof ToClientPacketSchema>
export const ToClientPacketSchema = HandshakeSchema.or(SpawnPlayerSchema)
  .or(DespawnPlayerSchema)
  .or(PlayerMotionSnapshotSchema)
  .or(PhysicsFullSnapshotSchema)
  .or(PhysicsDeltaSnapshotSchema)
  .or(PlayerAnimationSnapshotSchema)
  .or(PhysicsGrantObjectControlSchema)
  .or(PhysicsRevokeObjectControlSchema)
  .or(UpdateSyncedValueSchema)
  .or(CustomMessageSchema)

export type ToServerPacket = z.infer<typeof ToServerPacketSchema>
export const ToServerPacketSchema = HandshakeReadySchema.or(ChatMessageSchema)
  .or(CustomMessageSchema)
  .or(PlayerMotionSchema)
  .or(PlayerAnimationChangeSchema)
// .or(PhysicsRequestObjectControlSchema) TODO
// .or(PhysicsControlledObjectsSnapshotSchema)
