import type { Game } from "@dreamlab.gg/core"
import { renderUI } from "@dreamlab.gg/ui/dist/react"
import { Palette } from "./palette"
import type { Selector } from "./select"

export const renderEditorUI = (game: Game<false>, selectorEntity: Selector) => {
  console.log("rendering editor ui")

  return renderUI(game, <div>
    <Palette selector={selectorEntity} />
    {/* FIXME: we can't render the ScriptEditor component via dreamlab-ui because it expects a different React version to the one monaco-editor/react wants to pull in */}
  </div>)
}
