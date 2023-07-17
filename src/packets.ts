/* eslint-disable id-length */
import { z } from 'zod'

const VectorSchema = z.tuple([z.number(), z.number()])

export type HandshakePacket = z.infer<typeof HandshakeSchema>
export const HandshakeSchema = z.object({
  t: z.literal('Handshake'),

  peer_id: z.string(),
})

export type SpawnPlayerPacket = z.infer<typeof SpawnPlayerSchema>
export const SpawnPlayerSchema = z.object({
  t: z.literal('SpawnPlayer'),

  peer_id: z.string(),
  entity_id: z.string(),
  position: VectorSchema,
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
  position: VectorSchema,
  velocity: VectorSchema,
  flipped: z.boolean(),
})

export type PlayerMotionSnapshotPacket = z.infer<
  typeof PlayerMotionSnapshotSchema
>
export const PlayerMotionSnapshotSchema = z.object({
  t: z.literal('PlayerMotionSnapshot'),

  motion_info: PlayerMotionInfoSchema.array(),
})

export type PhysicsSnapshotPacket = z.infer<typeof PhysicsSnapshotSchema>
export const PhysicsSnapshotSchema = z.object({
  t: z.literal('PhysicsSnapshot'),
  // TODO
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

  position: VectorSchema,
  velocity: VectorSchema,
  flipped: z.boolean(),
})

export type PlayerAnimationChangePacket = z.infer<
  typeof PlayerAnimationChangeSchema
>
export const PlayerAnimationChangeSchema = z.object({
  t: z.literal('PlayerAnimationChange'),

  animation: z.string(),
})

export type ToClientPacket = z.infer<typeof ToClientPacketSchema>
export const ToClientPacketSchema = HandshakeSchema.or(SpawnPlayerSchema)
  .or(DespawnPlayerSchema)
  .or(PlayerMotionSnapshotSchema)
  .or(PhysicsSnapshotSchema)
  .or(PlayerAnimationSnapshotSchema)
  .or(CustomMessageSchema)

export type ToServerPacket = z.infer<typeof ToServerPacketSchema>
export const ToServerPacketSchema = ChatMessageSchema.or(CustomMessageSchema)
  .or(PlayerMotionSchema)
  .or(PlayerAnimationChangeSchema)
