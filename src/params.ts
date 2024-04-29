export interface ConnectionDetails {
  server: string
  instance: string
}

export interface PlayerInfo {
  token: string
  playerId: string
  nickname: string
  characterId: string | undefined
}

export interface GameParameters {
  connection: ConnectionDetails | undefined
  playerInfo: PlayerInfo | undefined

  debug: boolean
}

const params: GameParameters = {
  connection: undefined,
  playerInfo: undefined,
  debug: false,
}

// params is a global internally-mutable object so that we can
// load up a new instance without refreshing the window
export const getParams: () => GameParameters = () => {
  return params
}
