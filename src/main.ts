import './style.css'
import { jwtDecode } from 'jwt-decode'
import { init } from './game.js'
import { getParams } from './params.js'

const params = getParams()
const url = new URL(window.location.href)

const server = url.searchParams.get('server')
const instance = url.searchParams.get('instance')
const token = url.searchParams.get('token')
if (server && instance) {
  params.connection = {
    server,
    instance,
  }
}

if (token) {
  const jwt = jwtDecode(token)
  if (
    jwt &&
    typeof jwt === 'object' &&
    'player_id' in jwt &&
    typeof jwt.player_id === 'string' &&
    'nickname' in jwt &&
    typeof jwt.nickname === 'string'
  ) {
    params.playerInfo = {
      token,
      playerID: jwt.player_id,
      nickname: jwt.nickname,
    }
  }
}

params.debug = url.searchParams.get('debug') === 'true'

void document.fonts
  .load('1rem Fira Code')
  .then(async () => init())
  .catch(console.error)
