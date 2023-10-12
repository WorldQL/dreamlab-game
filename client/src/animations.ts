import {
  loadPlayerAnimations,
  loadPlayerSpritesheet,
  PlayerAnimationBonesSchema,
} from '@dreamlab.gg/core/textures'
import type { BoneMap, Fallback } from '@dreamlab.gg/core/textures'
import { typedFromEntries as fromEntries } from '@dreamlab.gg/core/utils'

export const getCharacterID = () => {
  const params = new URLSearchParams(window.location.search)
  const characterId = params.get('characterId')

  return characterId ?? undefined
}

type Animation = (typeof animations)[number]
const animations = [
  'idle',
  'walk',
  'jump',
  'greatsword',
  'bow',
  'punch',
] as const

const loadBones: BoneMap<Animation> = async animation => {
  const url = `/animations/${animation}.meta.json`

  const resp = await fetch(url)
  const json = await resp.json()

  return PlayerAnimationBonesSchema.parseAsync(json)
}

export const loadAnimations = async (characterID: string | undefined) => {
  const animationURL = (animation: string, fallback = false): string => {
    const stockURL = `/animations/${animation}.json` as const
    if (fallback === true) return stockURL
    if (characterID === undefined) return stockURL
    if (characterID === 'default') return stockURL

    return `https://dreamlab-user-assets.s3.amazonaws.com/${characterID}/${animation}.json`
  }

  const fallback: Fallback<Animation> = async animation => {
    const url = animationURL(animation, true)
    return loadPlayerSpritesheet(url)
  }

  const bones = fromEntries(animations.map(anim => [anim, loadBones] as const))
  const fallbackMap = fromEntries(
    animations.map(anim => [anim, fallback] as const),
  )

  return loadPlayerAnimations(animations, animationURL, bones, fallbackMap)
}
