/* eslint-disable id-length */
import { z } from 'zod'

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
  position: z.tuple([z.number(), z.number()]),
})

export type DespawnPlayerPacket = z.infer<typeof DespawnPlayerSchema>
export const DespawnPlayerSchema = z.object({
  t: z.literal('DespawnPlayer'),

  peer_id: z.string(),
  entity_id: z.string(),
})

export type PlayerMotionSnapshotPacket = z.infer<
  typeof PlayerMotionSnapshotSchema
>
export const PlayerMotionSnapshotSchema = z.object({
  t: z.literal('PlayerMotionSnapshot'),
  // TODO
})

export type PhysicsSnapshotPacket = z.infer<typeof PhysicsSnapshotSchema>
export const PhysicsSnapshotSchema = z.object({
  t: z.literal('PhysicsSnapshot'),
  // TODO
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

  position: z.tuple([z.number(), z.number()]),
  velocity: z.tuple([z.number(), z.number()]),
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
  .or(CustomMessageSchema)

export type ToServerPacket = z.infer<typeof ToServerPacketSchema>
export const ToServerPacketSchema = ChatMessageSchema.or(CustomMessageSchema)
  .or(PlayerMotionSchema)
  .or(PlayerAnimationChangeSchema)
