import { createEntity } from '@dreamlab.gg/core'
import type { SpawnableEntity } from '@dreamlab.gg/core'
import { Vec } from '@dreamlab.gg/core/dist/math'
import { drawBox } from '@dreamlab.gg/core/dist/utils'
import { Container, Graphics } from 'pixi.js'

export const createEntitySelect = () => {
  const colour = '#22a2ff'
  const strokeWidth = 2
  const squareSize = 8

  let selected: SpawnableEntity | undefined

  return createEntity({
    init({ game }) {
      return { debug: game.debug }
    },

    initRenderContext({ game }, { container, stage, camera }) {
      const onClick = (ev: MouseEvent) => {
        const pos = camera.localToWorld({ x: ev.offsetX, y: ev.offsetY })
        const query = game.queryPosition(pos)

        // TODO: Sort based on Z-index
        selected = query.length > 0 ? query[0] : undefined
      }

      container.addEventListener('click', onClick)

      const group = new Container()
      group.sortableChildren = true
      group.zIndex = 999_999_999 // always render on top

      const boundsGfx = new Graphics()
      const topLeftGfx = new Graphics()
      const topRightGfx = new Graphics()
      const bottomLeftGfx = new Graphics()
      const bottomRightGfx = new Graphics()

      stage.addChild(group)
      group.addChild(boundsGfx)
      group.addChild(topLeftGfx)
      group.addChild(topRightGfx)
      group.addChild(bottomLeftGfx)
      group.addChild(bottomRightGfx)

      return {
        container,
        camera,
        group,
        boundsGfx,
        topLeftGfx,
        topRightGfx,
        bottomLeftGfx,
        bottomRightGfx,
        onClick,
      }
    },

    teardown(_) {
      // No-op
    },

    teardownRenderContext({ container, group, onClick }) {
      container.removeEventListener('click', onClick)
      group.destroy({ children: true })
    },

    onRenderFrame(
      _,
      __,
      {
        camera,
        group,
        boundsGfx,
        topLeftGfx,
        topRightGfx,
        bottomLeftGfx,
        bottomRightGfx,
      },
    ) {
      const bounds = selected?.rectangleBounds()
      if (!selected || !bounds) {
        group.alpha = 0
        return
      }

      const inverse = 1 / camera.scale
      const scaledWidth = strokeWidth * inverse

      group.alpha = 1

      const pos = Vec.add(selected.transform.position, camera.offset)
      boundsGfx.position = pos

      const width = bounds.width + scaledWidth * 2
      const height = bounds.height + scaledWidth * 2
      drawBox(
        boundsGfx,
        { width, height },
        { stroke: colour, strokeWidth: scaledWidth },
      )

      const squaresSize = {
        width: squareSize * inverse,
        height: squareSize * inverse,
      }

      const squaresRender = {
        stroke: colour,
        strokeWidth: scaledWidth,
        fill: 'white',
        fillAlpha: 1,
      }

      drawBox(topLeftGfx, squaresSize, squaresRender)
      drawBox(topRightGfx, squaresSize, squaresRender)
      drawBox(bottomLeftGfx, squaresSize, squaresRender)
      drawBox(bottomRightGfx, squaresSize, squaresRender)

      topLeftGfx.position = Vec.add(pos, {
        x: bounds.width / 2 + scaledWidth / 2,
        y: -(bounds.height / 2 + scaledWidth / 2),
      })

      topRightGfx.position = Vec.add(pos, {
        x: -(bounds.width / 2 + scaledWidth / 2),
        y: -(bounds.height / 2 + scaledWidth / 2),
      })

      bottomLeftGfx.position = Vec.add(pos, {
        x: bounds.width / 2 + scaledWidth / 2,
        y: bounds.height / 2 + scaledWidth / 2,
      })

      bottomRightGfx.position = Vec.add(pos, {
        x: -(bounds.width / 2 + scaledWidth / 2),
        y: bounds.height / 2 + scaledWidth / 2,
      })
    },
  })
}
