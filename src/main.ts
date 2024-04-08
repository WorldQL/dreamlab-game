import '@fontsource/inter'
import '@fontsource/fira-code'
import './style.css'

import { init } from './game.js'

void Promise.allSettled([
  document.fonts.load('1rem Inter'),
  document.fonts.load('1rem Fira Code'),
]).then(() => {
  init()
})
