import { defineEnvironment, t } from '@luludev/env'

export const env = defineEnvironment({
  PORT: t.int().default(3_000),
})
