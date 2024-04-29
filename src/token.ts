import { jwtDecode as decodeJWT } from 'jwt-decode'

export const decodeToken = (token: string | undefined) => {
  if (!token) return undefined

  const jwt = decodeJWT(token)
  if (jwt === null || jwt === undefined) return undefined
  if (typeof jwt !== 'object') return undefined

  if (!('player_id' in jwt)) return undefined
  if (typeof jwt.player_id !== 'string') return undefined

  if (!('nickname' in jwt)) return undefined
  if (typeof jwt.nickname !== 'string') return undefined

  return {
    token,
    playerId: jwt.player_id,
    nickname: jwt.nickname,
  }
}
