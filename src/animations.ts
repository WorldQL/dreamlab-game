import {
  loadAnimations as loadAnims,
  loadSpritesheet,
} from '@dreamlab.gg/core/dist/textures'

const getCharacterID = () => {
  const params = new URLSearchParams(window.location.search)
  const characterId = params.get('characterId')

  return characterId ?? undefined
}

const animations = ['idle', 'walk', 'jump'] as const
export const loadAnimations = async () => {
  const characterID = getCharacterID()
  const animationURL = (animation: string, fallback = false): string => {
    const stockURL = `/animations/${animation}.json` as const
    if (fallback === true) return stockURL
    if (characterID === undefined) return stockURL
    if (characterID === 'default') return stockURL

    return `https://dreamlab-user-assets.s3.amazonaws.com/${characterID}/${animation}.json`
  }

  const fallback = async (animation: string) => {
    const url = animationURL(animation, true)
    return loadSpritesheet(url)
  }

  const fallbackMap = Object.fromEntries(
    animations.map(anim => [anim, fallback] as const),
  ) as Record<(typeof animations)[number], typeof fallback>

  return loadAnims(animations, animationURL, fallbackMap)
}
