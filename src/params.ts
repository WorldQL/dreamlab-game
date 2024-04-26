export interface ConnectionDetails {
  server: string
  instance: string
}

export interface PlayerInfo {
  token: string
  playerID: string
  nickname: string
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

export const getParams: () => GameParameters = () => {
  return params
}
