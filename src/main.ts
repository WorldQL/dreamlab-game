import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import '@fontsource/inter/700.css'
import '@fontsource/fira-code/400.css'
import '@fontsource/fira-code/500.css'
import '@fontsource/fira-code/600.css'

import './style.css'

void Promise.allSettled([
  document.fonts.load('1rem Inter'),
  document.fonts.load('1rem Fira Code'),
]).then(() => {
  init()
})
