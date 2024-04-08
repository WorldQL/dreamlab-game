import { createEnv } from '@t3-oss/env-core'
import { z } from 'zod'

export const env = createEnv({
  client: {
    VITE_DISCORD_CLIENT_ID: z.string().min(1),
  },
  clientPrefix: 'VITE_',
  runtimeEnvStrict: {
    VITE_DISCORD_CLIENT_ID: import.meta.env.VITE_DISCORD_CLIENT_ID,
  },
})
