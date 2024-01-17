import type {SpawnableEntity} from "@dreamlab.gg/core";
import axios from "axios";
import type { FC, ReactNode} from "https://esm.sh/v136/react@18.2.0";
import React, { useCallback, useState } from "https://esm.sh/v136/react@18.2.0";
import { styled } from "https://esm.sh/v136/styled-components@6.1.6";
import type { EditDetails } from "../../editor";
import { Button } from "../ui/buttons";

const getLevelScript = (entities: SpawnableEntity[]) => {
  // Filter out entities tagged as "do not save"
  const toSave = entities
    .filter(entity => !entity.definition.tags.includes('editor/doNotSave'))
    .map(entity => entity.definition)

  const json = JSON.stringify(
    toSave,
    (_key, value) => (value instanceof Set ? [...value] : value),
    2,
  )

  return `
// This file was generated by the Dreamlab editor.
// Entities tagged with 'editor/doNotSave' have not been persisted.
import type { LooseSpawnableDefinition } from '@dreamlab.gg/core'

export const level: LooseSpawnableDefinition[] = ${json}
`.trim()
};


const writeLevelScript = async (levelScript: string, editDetails?: EditDetails) => {
  if (editDetails === undefined) return

  const editUrl = new URL(editDetails.server)
  editUrl.protocol = editUrl.protocol === 'wss' ? 'https' : 'http'
  editUrl.pathname = `/api/v1/edit/${editDetails.instance}/files/level.ts`
  await axios.put(editUrl.toString(), levelScript, { headers: { "Content-Type": "text/plain", "Authorization": `Bearer ${editDetails.secret}` } })
}

const Popup: FC<{ children?: ReactNode }> = ({ children }) => {
  const PopupContainer = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  bottom: 0;
  right: 0;
  z-index: 1000;

  display: flex;
  align-items: center;
  justify-content: center;
  margin: 2rem;`
  
  const PopupBody = styled.div`
    width: 100%;
    max-height: 100%;
    max-width: 30rem;
    padding: 1rem;
    border-radius: 1rem;

    display: flex;
    flex-direction: column;

    background-color: rgba(230 230 230 / 1);
    box-shadow:
      0 4px 6px -1px rgb(0 0 0 / 0.3),
      0 2px 4px -2px rgb(0 0 0 / 0.3);
  `;

  return <PopupContainer>
    <PopupBody>
      {children}
    </PopupBody>
  </PopupContainer>
}

export const SaveButton: FC<{ editDetails?: EditDetails, entities: SpawnableEntity[] }> = ({ editDetails, entities }) => {
  const onSave = useCallback(async () => {
    const levelScript = getLevelScript(entities)
    await writeLevelScript(levelScript, editDetails)
    // TODO: commit
  }, [editDetails, entities])

  const [popupVisible, setPopupVisible] = useState(false)

  return <>
    {popupVisible && (<Popup>
      <p>Are you sure you want to overwrite <strong>level.ts</strong>?</p>
      
      {/* TODO: display the level script to be writeen in a scrollable <pre> at this stage */}

      <Button onClick={onSave}>Ok</Button>
      <Button onClick={() => setPopupVisible(false)}>Cancel</Button>
    </Popup>)}
    <Button onClick={() => setPopupVisible(true)} type='button'>
      Save
    </Button>
  </>
}
