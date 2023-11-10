import Editor from '@monaco-editor/react';
import monaco from "monaco-editor";
import type { CSSProperties, FC} from "react";
import React, { useEffect, useRef, useState } from "react";
import { createRoot } from 'react-dom/client';

const FileBrowser: FC<{ files: string[], loadFile(file: string): Promise<void>, currentFile: string }> = ({ files, loadFile, currentFile }) => {
  interface FileTreeNode { fullName: string, segment: string, children?: string[] }
  const fileTree: FileTreeNode[] = []
  for (const file of files) {
    const segments = file.split('/')
    let currentChildren: FileTreeNode[] = fileTree

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const segment = segments.shift()
      if (segment === undefined) break

      if (segments.length === 0) {
        currentChildren.push({ fullName: file, segment })
        break
      } else {
        const node = { fullName: file, segment, children: [] }
        currentChildren.push(node)
        currentChildren = node.children
      }
    }
  }

  // TODO: directory selection (store current and parent FileTreeNodes)
  // - show children of current in panel 3
  // - show current & siblings in panel 2
  // - show parent & its siblings in panel 1
  // if current is in the root dir, just show items in panel 1

  return <section style={{display: 'grid', gridTemplateColumns: 'auto auto auto'}}>
    <div style={{overflowY: "scroll", height: '6rem', fontFamily: 'monospace'}}>
      {fileTree.map(node => {
        const isDir = node.children !== undefined;
        const isCurrent = node.fullName === currentFile;

        return <a href="#"
            style={{display: 'block', color: isCurrent ? 'black' : 'blue', textDecoration: isCurrent ? 'underline' : 'none', fontWeight: isCurrent ? 'bold' : 'unset' }}
            onClick={isDir ? undefined /* TODO: traverse directory */ : () => void loadFile(node.fullName)}>
          {node.segment}{isDir ? '/' : ''}
        </a>
      })}
    </div>
    <div></div>
    <div></div>
  </section>
}

const ScriptEditor: FC<{ serverUrl: string, instanceId: string, editToken: string }> = ({ serverUrl, instanceId, editToken }) => {
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);

  const [files, setFiles] = useState<string[]>([]);

  const [currentFile, setCurrentFile] = useState<string | undefined>();

  const refreshFiles = async () => {
    const response = await fetch(`${serverUrl}/api/v1/edit/${instanceId}/files`, { method: "GET", })
    if (response.status === 200) {
      const { files }: { files: string[] } = await response.json()
      files.sort(undefined);
      setFiles(files)
      return files
    }

    return files
  }
  
  const loadFile = async (fileName: string) => {
    setCurrentFile(fileName);

    // TODO: cache open editor models (so that we don't have to fetch every time)

    const response = await fetch(`${serverUrl}/api/v1/edit/${instanceId}/files/${fileName}`, {
      method: "GET",
    });

    if (response.status === 200) {
      const fileContents = await response.text();
      editorRef.current!.setValue(fileContents);
    }
  }

  useEffect(() => {
    void (async () => {
      const files = await refreshFiles()
      const firstFile = files.at(0)
      if (firstFile !== undefined)
        await loadFile(firstFile)
    })()
  }, [])

  const saveFile = async (fileName: string, fileContents: string) => {
    const response = await fetch(`${serverUrl}/api/v1/edit/${instanceId}/files/${fileName}`, {
      method: "PUT",
      headers: {
        "Authorization": `Bearer ${editToken}`,
        "Content-Type": "application/octet-stream",
      },
      body: new TextEncoder().encode(fileContents)
    });

    // TODO: check response.status
  };

  return (
    <aside style={{display: "flex", flexDirection: "column", height: "100vh"}}>
      <FileBrowser files={files} loadFile={loadFile} currentFile={currentFile ? currentFile : ''} />
      <section style={{flex: "1"}}>
        <Editor height="100%" defaultLanguage="javascript" onMount={(editor) => { editorRef.current = editor }} />
      </section>
      <button onClick={() => {
        const fileName = currentFile!
        const fileContents = editorRef.current!.getValue();
        void saveFile(fileName, fileContents)
      }}>Save</button>
    </aside>
  )
}

export const setupScriptEditor = (serverUrl: string, instanceId: string, editToken: string) => {
  // TODO & FIXME: fold into editor-ui.tsx once we work out the module problems
  const container: HTMLElement = document.querySelector("#game-container > #script-editor")!;
  container.style.display = "block";

  const root = createRoot(container);
  root.render(<ScriptEditor serverUrl={serverUrl} instanceId={instanceId} editToken={editToken} />);
}
