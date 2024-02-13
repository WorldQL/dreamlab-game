import { createEntity } from '@dreamlab.gg/core'
import { ref } from '@dreamlab.gg/core/utils'
import { createLogStreamingClient } from './log-stream'
import { renderUI } from './ui'

export enum ConsoleInputs {
  ToggleConsole = '@console/ToggleConsole',
}

export const createConsole = (server: string, instance: string) => {
  const enabled = ref<boolean>(false)

  return createEntity({
    init({ game }) {
      const inputs = game.client?.inputs
      inputs?.registerInput(
        ConsoleInputs.ToggleConsole,
        'Toggle Console',
        'Semicolon',
      )

      return { game }
    },
    initRenderContext({ game }, _render) {
      const client = createLogStreamingClient(server, instance)

      const { container, unmount } = renderUI(game, client)

      container.style.display = 'none'
      const inputs = game.client?.inputs
      inputs?.addListener(ConsoleInputs.ToggleConsole, pressed => {
        if (pressed) {
          enabled.value = !enabled.value
          container.style.display = enabled.value ? 'unset' : 'none'
        }
      })

      return { unmount }
    },
    teardownRenderContext({ unmount }) {
      unmount()
    },
    teardown() {},
  })
}
