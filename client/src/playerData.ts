import type { ObjectItem, PlayerData } from '@dreamlab.gg/core/managers'
import { PlayerDataManager } from '@dreamlab.gg/core/managers'

let resolveObjects: (value: ObjectItem[] | PromiseLike<ObjectItem[]>) => void
const objectsPromise = new Promise<ObjectItem[]>(resolve => {
  resolveObjects = resolve
})

const storePlayerData = (data: PlayerData) => {
  window.localStorage.setItem('globalPassedPlayerData', JSON.stringify(data))
}

const updatePlayerManager = (data: PlayerData) => {
  return PlayerDataManager.setAll(data)
}

export const getObjects = async () => objectsPromise

window.addEventListener('message', ev => {
  const data: PlayerData = ev.data

  if (data?.user && data?.inputs) {
    storePlayerData(data)
    const updatedData = updatePlayerManager(data)
    resolveObjects(updatedData?.objects ?? [])
  }
})
