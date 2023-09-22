import type { ObjectItem, PlayerData } from '@dreamlab.gg/core/managers'
import { PlayerDataManager } from '@dreamlab.gg/core/managers'
import { TextureManager } from '@dreamlab.gg/core/textures'

let objects: ObjectItem[]
let resolveObjects: (value: ObjectItem[] | PromiseLike<ObjectItem[]>) => void

const objectsPromise = new Promise<ObjectItem[]>(resolve => {
  resolveObjects = resolve
})

window.addEventListener('message', async ev => {
  const data: PlayerData = ev.data

  if (data?.user && data?.inputs) {
    window.localStorage.setItem('globalPassedPlayerData', JSON.stringify(data))

    const updatedData = PlayerDataManager.setAll(data)
    if (updatedData) {
      objects = updatedData.objects
    }

    if (objects) {
      const promises = objects
        .filter(obj => obj.imageTasks?.[0]?.imageURL)
        .map(async obj =>
          TextureManager.loadTexture(obj.imageTasks[0].imageURL),
        )

      await Promise.all(promises)
    }

    resolveObjects(objects)
  }
})

export const getObjects = async () => objectsPromise
