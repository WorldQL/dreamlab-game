export { loadCharacterAnimations as loadAnimations } from '@dreamlab.gg/core/textures'

export const getCharacterID = () => {
  const params = new URLSearchParams(window.location.search)
  const characterId = params.get('characterId')

  return characterId ?? undefined
}
