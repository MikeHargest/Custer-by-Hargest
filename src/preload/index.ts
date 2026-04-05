import { contextBridge } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

import { ipcRenderer } from 'electron'

// Custom APIs for renderer
const api = {
  selectAudioFile: () => ipcRenderer.invoke('dialog:openFile'),
  selectImageFile: () => ipcRenderer.invoke('dialog:openImage'),

  getStoreValue: (key: string) => ipcRenderer.invoke('store:get', key),
  setStoreValue: (key: string, value: any) => ipcRenderer.invoke('store:set', key, value),
  showNotification: (title: string, body: string) =>
    ipcRenderer.send('notification:show', title, body),
  toggleAlwaysOnTop: (flag: boolean) => ipcRenderer.invoke('window:toggleAlwaysOnTop', flag),

  // Mini-Window APIs
  createMiniWindow: (timerId: string) => ipcRenderer.send('create-mini-window', timerId),
  closeMiniWindow: (timerId: string) => ipcRenderer.send('close-mini-window', timerId),
  syncTimerState: (timerId: string, state: any) =>
    ipcRenderer.send('sync-timer-state', timerId, state),
  actionTimer: (timerId: string, action: string) =>
    ipcRenderer.send('action-timer', timerId, action),

  onSyncTimerState: (callback: (timerId: string, state: any) => void) => {
    const listener = (_: any, timerId: string, state: any) => callback(timerId, state)
    ipcRenderer.on('on-sync-timer-state', listener)
    return () => {
      ipcRenderer.removeListener('on-sync-timer-state', listener)
    }
  },
  onActionTimer: (callback: (timerId: string, action: string) => void) => {
    const listener = (_: any, timerId: string, action: string) => callback(timerId, action)
    ipcRenderer.on('on-action-timer', listener)
    return () => {
      ipcRenderer.removeListener('on-action-timer', listener)
    }
  },
  onMiniWindowClosed: (callback: (timerId: string) => void) => {
    const listener = (_: any, timerId: string) => callback(timerId)
    ipcRenderer.on('mini-window-closed', listener)
    return () => {
      ipcRenderer.removeListener('mini-window-closed', listener)
    }
  },

  // Notes File System
  getNotesDefaultDir: () => ipcRenderer.invoke('notes:getDefaultDir'),
  selectNotesDirectory: () => ipcRenderer.invoke('notes:selectDirectory'),
  readNote: (dirPath: string, fileName: string) =>
    ipcRenderer.invoke('notes:read', dirPath, fileName),
  saveNote: (dirPath: string, fileName: string, content: string) =>
    ipcRenderer.invoke('notes:save', dirPath, fileName, content),
  deleteNote: (dirPath: string, fileName: string) =>
    ipcRenderer.invoke('notes:delete', dirPath, fileName),
  moveNote: (oldDir: string, newDir: string, fileName: string) =>
    ipcRenderer.invoke('notes:move', oldDir, newDir, fileName),
  listNotes: (dirPath: string) => ipcRenderer.invoke('notes:list', dirPath),

  // Boards File System
  readBoard: (dirPath: string, fileName: string) =>
    ipcRenderer.invoke('boards:read', dirPath, fileName),
  saveBoard: (dirPath: string, fileName: string, content: string) =>
    ipcRenderer.invoke('boards:save', dirPath, fileName, content),
  deleteBoard: (dirPath: string, fileName: string) =>
    ipcRenderer.invoke('boards:delete', dirPath, fileName),
  moveBoard: (oldDir: string, newDir: string, fileName: string) =>
    ipcRenderer.invoke('boards:move', oldDir, newDir, fileName),
  listBoards: (dirPath: string) => ipcRenderer.invoke('boards:list', dirPath),
  saveIbo: (dirPath: string, fileName: string, boardContent: string) =>
    ipcRenderer.invoke('boards:saveIbo', dirPath, fileName, boardContent),
  readIbo: (dirPath: string, fileName: string) =>
    ipcRenderer.invoke('boards:readIbo', dirPath, fileName),

  // Window controls
  minimizeWindow: () => ipcRenderer.send('window:minimize'),
  maximizeWindow: () => ipcRenderer.send('window:maximize'),
  closeWindow: () => ipcRenderer.send('window:close'),

  // Projects Data
  selectProjectsFile: (type: 'save' | 'open') => ipcRenderer.invoke('projects:selectFile', type),
  exportProjects: (filePath: string, data: string) =>
    ipcRenderer.invoke('projects:export', filePath, data),
  importProjects: (filePath: string) => ipcRenderer.invoke('projects:import', filePath),

  // Workspace
  selectWorkspace: () => ipcRenderer.invoke('workspace:select'),
  createWorkspace: (parentPath: string, name: string) =>
    ipcRenderer.invoke('workspace:create', parentPath, name),
  initProjectFolder: (workspacePath: string, projectName: string) =>
    ipcRenderer.invoke('workspace:initProject', workspacePath, projectName),
  readWorkspaceJson: (filePath: string) => ipcRenderer.invoke('workspace:readJson', filePath),
  writeWorkspaceJson: (filePath: string, data: any) =>
    ipcRenderer.invoke('workspace:writeJson', filePath, data),
  deleteProjectFolder: (projectPath: string) =>
    ipcRenderer.invoke('workspace:deleteProjectFolder', projectPath),
  renameProjectFolder: (oldPath: string, newName: string) =>
    ipcRenderer.invoke('workspace:renameProjectFolder', oldPath, newName),
  listProjects: (workspacePath: string) =>
    ipcRenderer.invoke('workspace:listProjects', workspacePath),
  getFolderSize: (folderPath: string) => ipcRenderer.invoke('workspace:getFolderSize', folderPath),

  // Custom resize (for transparent frameless window)
  windowResizeStart: (direction: string) => ipcRenderer.send('window:resizeStart', direction),
  windowResizeEnd: () => ipcRenderer.send('window:resizeEnd')
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
