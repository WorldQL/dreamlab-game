import './style.css'
import { init } from './game.js'

void document.fonts
  .load('1rem Fira Code')
  .then(async () => init())
  .catch(console.error)
