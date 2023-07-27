import * as InputCore from '@dreamlab.gg/core/input'

type Inputs = typeof inputs
export type Input = Inputs[number]
export const inputs = [
  'left',
  'right',
  'jump',
  'crouch',
  'toggle-noclip',
  'toggle-debug',
] as const

export type InputDescriptions = InputCore.InputDescriptions<Inputs>
export const inputDescriptions: InputDescriptions = {
  left: 'Move Left',
  right: 'Move Right',
  jump: 'Jump',
  crouch: 'Crouch / Jump Down',

  'toggle-noclip': 'Toggle Noclip',
  'toggle-debug': 'Toggle Debug View',
}

export type InputMap = InputCore.InputMap<Inputs>
export const defaultInputMap: InputMap = {
  left: { primary: 'KeyA', secondary: 'ArrowLeft' },
  right: { primary: 'KeyD', secondary: 'ArrowRight' },
  jump: { primary: 'Space', secondary: 'KeyW' },
  crouch: { primary: 'KeyS', secondary: 'ArrowDown' },

  'toggle-noclip': { primary: 'KeyV' },
  'toggle-debug': { primary: 'KeyP' },
}

export type InputEmitter = InputCore.InputEmitter<Inputs>
export const emitter = new InputCore.InputEmitter(inputs)
