import type { Game } from '@dreamlab.gg/core'
import { inputCodes } from '@dreamlab.gg/core/input'
import type { InputCode } from '@dreamlab.gg/core/input'

const storageKey = (key: InputCode): string => `@dreamlab/Input/${key}`

export const bindInput = (
  game: Game<false>,
  key: InputCode,
  input: string | undefined,
): void => {
  const inputs = game.client.inputs
  inputs.bindInput(key, input)

  const inputKey = storageKey(key)
  if (input !== undefined) localStorage.setItem(inputKey, input)
  else localStorage.removeItem(inputKey)
}

export const loadBindings = (game: Game<false>) => {
  const inputs = game.client.inputs

  for (const key of inputCodes) {
    const input = localStorage.getItem(storageKey(key))
    if (input) inputs.bindInput(key, input)
  }
}
