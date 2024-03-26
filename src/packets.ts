import { SpawnableDefinitionSchema } from '@dreamlab.gg/core'
import { BaseGearSchema } from '@dreamlab.gg/core/managers'
import { z } from 'zod'

export const PROTOCOL_VERSION = 8

const TupleVectorSchema = z.tuple([z.number(), z.number()])
const ObjectVectorSchema = z.object({ x: z.number(), y: z.number() })

export type HandshakePacket = z.infer<typeof HandshakeSchema>
export const HandshakeSchema = z.object({
  t: z.literal('Handshake'),

  protocol_version: z.number(),
  connection_id: z.string(),
  world_id: z.string(),
  edit_mode: z.boolean(),
  world_script_url_base: z.string().optional().nullable(),
  edit_secret: z.string().optional().nullable(),
})

export type DisconnectingPacket = z.infer<typeof DisconnectingSchema>
export const DisconnectingSchema = z.object({
  t: z.literal('Disconnecting'),
  reason: z.enum(['Restarting', 'ShuttingDown', 'Unknown']),
})

export type HandshakeReadyPacket = z.infer<typeof HandshakeReadySchema>
export const HandshakeReadySchema = z.object({
  t: z.literal('HandshakeReady'),
})

export type SpawnPlayerPacket = z.infer<typeof SpawnPlayerSchema>
export const SpawnPlayerSchema = z.object({
  t: z.literal('SpawnPlayer'),

  connection_id: z.string(),
  player_id: z.string(),
  character_id: z.string().optional(),
  nickname: z.string().optional(),
  entity_id: z.string(),
  position: TupleVectorSchema,
  level: z.unknown(),
})

export type DespawnPlayerPacket = z.infer<typeof DespawnPlayerSchema>
export const DespawnPlayerSchema = z.object({
  t: z.literal('DespawnPlayer'),

  connection_id: z.string(),
  entity_id: z.string(),
})

export type PlayerMotionInfo = z.infer<typeof PlayerMotionInfoSchema>
export const PlayerMotionInfoSchema = z.object({
  entity_id: z.string(),
  position: TupleVectorSchema,
  velocity: TupleVectorSchema,
  flipped: z.boolean(),
})

export type PlayerMotionSnapshotPacket = z.infer<typeof PlayerMotionSnapshotSchema>
export const PlayerMotionSnapshotSchema = z.object({
  t: z.literal('PlayerMotionSnapshot'),

  motion_info: PlayerMotionInfoSchema.array(),
})

export type PlayerCharacterIdInfo = z.infer<typeof PlayerCharacterIdInfoSchema>
export const PlayerCharacterIdInfoSchema = z.object({
  entity_id: z.string(),
  character_id: z.string().nullable(),
})

export type PlayerCharacterIdSnapshotPacket = z.infer<typeof PlayerCharacterIdSnapshotSchema>
export const PlayerCharacterIdSnapshotSchema = z.object({
  t: z.literal('PlayerCharacterIdSnapshot'),

  character_id_info: PlayerCharacterIdInfoSchema.array(),
})

export type PlayerAnimationInfo = z.infer<typeof PlayerAnimationInfoSchema>
export const PlayerAnimationInfoSchema = z.object({
  entity_id: z.string(),
  animation: z.string(),
})

export type PlayerAnimationSnapshotPacket = z.infer<typeof PlayerAnimationSnapshotSchema>
export const PlayerAnimationSnapshotSchema = z.object({
  t: z.literal('PlayerAnimationSnapshot'),

  animation_info: PlayerAnimationInfoSchema.array(),
})

export type PlayerGearInfo = z.infer<typeof PlayerGearInfoSchema>
export const PlayerGearInfoSchema = z.object({
  entity_id: z.string(),
  gear: BaseGearSchema.nullable(),
})

export type PlayerGearSnapshotPacket = z.infer<typeof PlayerGearSnapshotSchema>
export const PlayerGearSnapshotSchema = z.object({
  t: z.literal('PlayerGearSnapshot'),

  gear_info: PlayerGearInfoSchema.array(),
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

export type PlayerCharacterIdChangePacket = z.infer<typeof PlayerCharacterIdChangeSchema>
export const PlayerCharacterIdChangeSchema = z.object({
  t: z.literal('PlayerCharacterIdChange'),

  character_id: z.string().nullable(),
})

export type PlayerAnimationChangePacket = z.infer<typeof PlayerAnimationChangeSchema>
export const PlayerAnimationChangeSchema = z.object({
  t: z.literal('PlayerAnimationChange'),

  animation: z.string(),
})

export type PlayerGearChangePacket = z.infer<typeof PlayerGearChangeSchema>
export const PlayerGearChangeSchema = z.object({
  t: z.literal('PlayerGearChange'),

  // gear: BaseGearSchema.nullable(),
  gear: z.unknown(),
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

export type PhysicsFullSnapshotPacket = z.infer<typeof PhysicsFullSnapshotSchema>
export const PhysicsFullSnapshotSchema = z.object({
  t: z.literal('PhysicsFullSnapshot'),
  lastClientTickNumber: z.number(),

  snapshot: z.object({
    tickNumber: z.number(),
    entities: EntitySnapshotSchema.array(),
  }),
})

export type PhysicsDeltaSnapshotPacket = z.infer<typeof PhysicsFullSnapshotSchema>
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

export type PhysicsGrantObjectControlPacket = z.infer<typeof PhysicsGrantObjectControlSchema>
export const PhysicsGrantObjectControlSchema = z.object({
  t: z.literal('PhysicsGrantObjectControl'),
  entity_id: z.string(),
  expiry_tick: z.number(),
})

export type PhysicsRevokeObjectControlPacket = z.infer<typeof PhysicsRevokeObjectControlSchema>
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

export type IncomingSpawnEntityPacket = z.infer<typeof IncomingSpawnEntitySchema>
export const IncomingSpawnEntitySchema = z.object({
  t: z.literal('SpawnEntity'),
  definition: z.unknown(),
})

export type IncomingDestroyEntityPacket = z.infer<typeof IncomingDestroyEntitySchema>
export const IncomingDestroyEntitySchema = z.object({
  t: z.literal('DestroyEntity'),
  entity_id: z.string(),
})

export type IncomingTransformChangedPacket = z.infer<typeof IncomingTransformChangedSchema>
export const IncomingTransformChangedSchema = z.object({
  t: z.literal('TransformChanged'),

  entity_id: z.string(),
  position: TupleVectorSchema,
  rotation: z.number(),
  z_index: z.number(),
})

export type IncomingArgsChangedPacket = z.infer<typeof IncomingArgsChangedSchema>
export const IncomingArgsChangedSchema = z.object({
  t: z.literal('ArgsChanged'),

  entity_id: z.string(),
  path: z.string(),
  value: z.unknown(),
})

export type IncomingLabelChangedPacket = z.infer<typeof IncomingLabelChangedSchema>
export const IncomingLabelChangedSchema = z.object({
  t: z.literal('LabelChanged'),

  entity_id: z.string(),
  label: z.string().optional(),
})

export type IncomingTagsChangedPacket = z.infer<typeof IncomingTagsChangedSchema>
export const IncomingTagsChangedSchema = z.object({
  t: z.literal('TagsChanged'),

  entity_id: z.string(),
  tags: z.string().array(),
})

export type IncomingPhysicsSuspendResumePacket = z.infer<typeof IncomingPhysicsSuspendResumeSchema>
export const IncomingPhysicsSuspendResumeSchema = z.object({
  t: z.literal('PhysicsSuspendResume'),

  entity_id: z.string(),
  action: z.enum(['suspend', 'resume']),
})

export type OutgoingSpawnEntityPacket = z.infer<typeof OutgoingSpawnEntitySchema>
export const OutgoingSpawnEntitySchema = IncomingSpawnEntitySchema.extend({
  connection_id: z.string(),
})

export type OutgoingDestroyEntityPacket = z.infer<typeof OutgoingDestroyEntitySchema>
export const OutgoingDestroyEntitySchema = IncomingDestroyEntitySchema.extend({
  connection_id: z.string(),
})

export type OutgoingTransformChangedPacket = z.infer<typeof OutgoingTransformChangedSchema>
export const OutgoingTransformChangedSchema = IncomingTransformChangedSchema.extend({
  connection_id: z.string(),
})

export type OutgoingArgsChangedPacket = z.infer<typeof OutgoingArgsChangedSchema>
export const OutgoingArgsChangedSchema = IncomingArgsChangedSchema.extend({
  connection_id: z.string(),
})

export type OutgoingLabelChangedPacket = z.infer<typeof OutgoingLabelChangedSchema>
export const OutgoingLabelChangedSchema = IncomingLabelChangedSchema.extend({
  connection_id: z.string(),
})

export type OutgoingTagsChangedPacket = z.infer<typeof OutgoingTagsChangedSchema>
export const OutgoingTagsChangedSchema = IncomingTagsChangedSchema.extend({
  connection_id: z.string(),
})

export type OutgoingPhysicsSuspendResumePacket = z.infer<typeof OutgoingPhysicsSuspendResumeSchema>
export const OutgoingPhysicsSuspendResumeSchema = IncomingPhysicsSuspendResumeSchema.extend({
  connection_id: z.string(),
})

export type PhysicsRequestObjectControlPacket = z.infer<typeof OutgoingPhysicsSuspendResumeSchema>
export const PhysicsRequestObjectControlSchema = z.object({
  t: z.literal('PhysicsRequestObjectControl'),

  entity_id: z.string(),
})

export type PhysicsControlledObjectsSnapshotPacket = z.infer<
  typeof OutgoingPhysicsSuspendResumeSchema
>
export const PhysicsControlledObjectsSnapshotSchema = z.object({
  t: z.literal('PhysicsControlledObjectsSnapshot'),
  tick_number: z.number(),
  snapshot: z.unknown(),
})

export type RequestFullSnapshotPacket = z.infer<typeof RequestFullSnapshotSchema>
export const RequestFullSnapshotSchema = z.object({
  t: z.literal('RequestFullSnapshot'),
  // TODO
})

export type ToClientPacket = z.infer<typeof ToClientPacketSchema>
export const ToClientPacketSchema = z.discriminatedUnion('t', [
  HandshakeSchema,
  DisconnectingSchema,
  SpawnPlayerSchema,
  DespawnPlayerSchema,
  PlayerMotionSnapshotSchema,
  PlayerCharacterIdSnapshotSchema,
  PlayerGearSnapshotSchema,
  PhysicsFullSnapshotSchema,
  PhysicsDeltaSnapshotSchema,
  PlayerAnimationSnapshotSchema,
  PhysicsGrantObjectControlSchema,
  PhysicsRevokeObjectControlSchema,
  UpdateSyncedValueSchema,
  CustomMessageSchema,
  OutgoingSpawnEntitySchema,
  OutgoingDestroyEntitySchema,
  OutgoingTransformChangedSchema,
  OutgoingArgsChangedSchema,
  OutgoingLabelChangedSchema,
  OutgoingTagsChangedSchema,
  OutgoingPhysicsSuspendResumeSchema,
])

export type ToServerPacket = z.infer<typeof ToServerPacketSchema>
export const ToServerPacketSchema = z.discriminatedUnion('t', [
  HandshakeReadySchema,
  ChatMessageSchema,
  CustomMessageSchema,
  IncomingSpawnEntitySchema,
  IncomingDestroyEntitySchema,
  IncomingArgsChangedSchema,
  IncomingLabelChangedSchema,
  IncomingTagsChangedSchema,
  IncomingTransformChangedSchema,
  IncomingPhysicsSuspendResumeSchema,
  PlayerCharacterIdChangeSchema,
  PlayerAnimationChangeSchema,
  PlayerInputsPacketSchema,
  PlayerMotionSchema,
  PlayerGearChangeSchema,
  PhysicsRequestObjectControlSchema,
  PhysicsControlledObjectsSnapshotSchema,
  RequestFullSnapshotSchema,
  UpdateSyncedValueSchema,
])
