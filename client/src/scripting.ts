import type { Game } from '@dreamlab.gg/core'

export const loadScript = async (
  world: string,
  game: Game<false>,
): Promise<void> => {
  const module: unknown = await import(
    /* @vite-ignore */ `/worlds/${world}/client.js`
  )

  if (module === undefined) return
  if (module === null) return
  if (typeof module !== 'object') return

  if ('init' in module && typeof module.init === 'function') {
    await module.init(game)
  }
}
