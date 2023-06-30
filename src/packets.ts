/* eslint-disable id-length */
import { z } from 'zod'

export type CustomMessagePacket = z.infer<typeof CustomMessageSchema>
export const CustomMessageSchema = z.object({
  t: z.literal('CustomMessage'),

  channel: z.string(),
  data: z.record(z.string(), z.unknown()),
})

export type ToServerPacket = z.infer<typeof ToServerPacketSchema>
export const ToServerPacketSchema = CustomMessageSchema

export type ToClientPacket = z.infer<typeof ToClientPacketSchema>
export const ToClientPacketSchema = CustomMessageSchema
