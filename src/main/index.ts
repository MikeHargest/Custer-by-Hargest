import { app, shell, BrowserWindow, ipcMain, dialog, Notification, screen, protocol, Tray, Menu, nativeImage } from 'electron'
import path, { join } from 'path'
import fs from 'fs'
import { Readable } from 'stream'
import JSZip from 'jszip'
import yauzl from 'yauzl'
import yazl from 'yazl'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import StoreModule from 'electron-store'
import matter from 'gray-matter'

// Handle ESM / CJS interop for electron-store
const Store = typeof StoreModule === 'function' ? StoreModule : (StoreModule as any).default
const store = new Store()
const globalIconPath = join(__dirname, process.platform === 'win32' ? '../../resources/icon.ico' : '../../resources/icon.png')

// ===== Single Instance Lock =====
// Prevents multiple instances of the app from running simultaneously,
// which would create duplicate tray icons and processes.
const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    // Someone tried to run a second instance — focus the existing window
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      if (!mainWindow.isVisible()) mainWindow.show()
      mainWindow.focus()
    }
  })
}

let mainWindow: BrowserWindow | null = null
let appTray: Tray | null = null
const miniWindows: Record<string, BrowserWindow> = {}

function createWindow(): void {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 1500,
    height: 960,
    show: false,
    frame: false,
    transparent: false,
    resizable: true,
    thickFrame: true,
    autoHideMenuBar: true,
    backgroundColor: '#1B1B1B',
    icon: globalIconPath,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      webSecurity: false, // allow playing local mp3 files
      backgroundThrottling: false
    }
  })

  mainWindow?.on('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow?.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // Hide instead of close to keep in tray
  mainWindow?.on('close', (e) => {
    if (!(app as any).isQuiting) {
      e.preventDefault()
      mainWindow?.hide()
    }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// IPC handlers
ipcMain.handle('dialog:openFile', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'Audio', extensions: ['mp3', 'wav'] }]
  })
  if (!canceled && filePaths.length > 0) {
    return filePaths[0]
  }
  return null
})
ipcMain.handle('dialog:openImage', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'Images', extensions: ['jpg', 'png', 'gif', 'webp', 'jpeg'] }]
  })
  if (!canceled && filePaths.length > 0) {
    return filePaths[0]
  }
  return null
})

// ===== WORKSPACE IPC HANDLERS =====
ipcMain.handle('workspace:select', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: 'Select Workspace Folder',
    properties: ['openDirectory', 'createDirectory']
  })
  if (!canceled && filePaths.length > 0) {
    return filePaths[0]
  }
  return null
})

ipcMain.handle('workspace:create', (_, parentPath: string, name: string) => {
  try {
    const dir = join(parentPath, name)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    return dir
  } catch (error) {
    console.error('Failed to create workspace folder:', error)
    return null
  }
})

ipcMain.handle('workspace:initProject', (_, workspacePath: string, projectName: string) => {
  try {
    const baseSafeName = projectName.replace(/[<>:"/\\|?*]/g, '_')
    let safeName = baseSafeName
    let projectDir = join(workspacePath, safeName)
    let counter = 1

    while (fs.existsSync(projectDir)) {
      safeName = `${baseSafeName} ${counter}`
      projectDir = join(workspacePath, safeName)
      counter++
    }

    const dirs = [
      projectDir,
      join(projectDir, 'notes'),
      join(projectDir, 'boards'),
      join(projectDir, 'tasks'),
      join(projectDir, 'attachments')
    ]
    for (const dir of dirs) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }
    }
    return projectDir
  } catch (error) {
    console.error('Failed to init project folder:', error)
    return null
  }
})

ipcMain.handle('workspace:readJson', (_, filePath: string) => {
  try {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8')
      return JSON.parse(content)
    }
    return null
  } catch (error) {
    console.error('Failed to read workspace JSON:', error)
    return null
  }
})

ipcMain.handle('workspace:writeJson', (_, filePath: string, data: any) => {
  try {
    const content = JSON.stringify(data, null, 2)
    const folder = join(filePath, '..')
    if (!fs.existsSync(folder)) {
      fs.mkdirSync(folder, { recursive: true })
    }
    fs.writeFileSync(filePath, content, 'utf-8')
    return true
  } catch (error) {
    console.error('Failed to write workspace JSON:', error)
    return false
  }
})

ipcMain.handle('workspace:deleteProjectFolder', (_, projectPath: string) => {
  try {
    if (fs.existsSync(projectPath)) {
      console.log('[deleteProjectFolder] Deleting directory:', projectPath)
      fs.rmSync(projectPath, { recursive: true, force: true })
    } else {
      console.log('[deleteProjectFolder] Directory not found:', projectPath)
    }
    return true
  } catch (error) {
    console.error('Failed to delete project folder:', error)
    return false
  }
})

ipcMain.handle('workspace:renameProjectFolder', (_, oldPath: string, newName: string) => {
  try {
    console.log('[renameProjectFolder] requested:', { oldPath, newName })
    if (!fs.existsSync(oldPath)) {
      console.log('[renameProjectFolder] oldPath does not exist:', oldPath)
      return oldPath
    }
    const parentDir = path.dirname(oldPath)
    const safeName = newName.replace(/[<>:"/\\|?*]/g, '_')
    const newPath = join(parentDir, safeName)
    console.log('[renameProjectFolder] computing newPath:', newPath)

    if (oldPath !== newPath) {
      let finalPath = newPath
      let counter = 1
      while (fs.existsSync(finalPath) && finalPath.toLowerCase() !== oldPath.toLowerCase()) {
        finalPath = join(parentDir, `${safeName} ${counter}`)
        counter++
      }

      if (!fs.existsSync(finalPath) || finalPath.toLowerCase() === oldPath.toLowerCase()) {
        console.log('[renameProjectFolder] calling fs.renameSync to:', finalPath)
        fs.renameSync(oldPath, finalPath)
        console.log('[renameProjectFolder] rename successful')
        return finalPath
      } else {
        console.log('[renameProjectFolder] target already exists even after suffix, skipping')
      }
    }
    return oldPath
  } catch (error) {
    console.error('Failed to rename project folder:', error)
    return oldPath
  }
})

ipcMain.handle('workspace:listProjects', (_, workspacePath: string) => {
  try {
    if (!fs.existsSync(workspacePath)) return []
    return fs.readdirSync(workspacePath).filter((f: string) => {
      const fullPath = join(workspacePath, f)
      return fs.statSync(fullPath).isDirectory() && f !== '.workspace'
    })
  } catch (error) {
    console.error('Failed to list workspace projects:', error)
    return []
  }
})

ipcMain.handle('workspace:scanAllNotes', async (_, workspacePath: string) => {
  try {
    if (!fs.existsSync(workspacePath)) return []
    const projects = fs.readdirSync(workspacePath).filter((f: string) => {
      const fullPath = join(workspacePath, f)
      return fs.statSync(fullPath).isDirectory() && f !== '.workspace'
    })

    const allNotes: any[] = []

    const scanDir = async (dir: string, projectId: string, type: 'markdown' | 'board', isTrash = false): Promise<any[]> => {
      if (!fs.existsSync(dir)) return []
      const files = fs.readdirSync(dir)
      const results: any[] = []

      for (const f of files) {
        const fullPath = join(dir, f)
        
        // Skip subdirectories (like 'trash') — they are scanned separately
        try {
          if (fs.statSync(fullPath).isDirectory()) continue
        } catch { continue }
        
        const isBoard = f.endsWith('.board') || f.endsWith('.ibo')
        const isNote = f.endsWith('.json') || f.endsWith('.md')

        if (type === 'markdown' && !isNote) continue
        if (type === 'board' && !isBoard) continue

        try {
          if (isNote) {
            const raw = fs.readFileSync(fullPath, 'utf-8')
            if (f.endsWith('.md')) {
              const parsedMatter = matter(raw)
              if (parsedMatter.data && parsedMatter.data.id) {
                results.push({
                  ...parsedMatter.data,
                  content: parsedMatter.content,
                  fileName: f,
                  isTrash,
                  lastModified: fs.statSync(fullPath).mtimeMs
                })
              }
            } else {
              const parsed = JSON.parse(raw)
              if (parsed && typeof parsed === 'object' && parsed.id) {
                results.push({
                  ...parsed,
                  fileName: f,
                  isTrash,
                  lastModified: fs.statSync(fullPath).mtimeMs
                })
              }
            }
          } else if (isBoard) {
            // For boards, we need to read board.json from the zip to get the ID/Title
            const boardDataRaw = await new Promise<string>((resolve) => {
              yauzl.open(fullPath, { lazyEntries: true }, (err, zipfile) => {
                if (err || !zipfile) { resolve(''); return }
                let found = false
                zipfile.readEntry()
                zipfile.on('entry', (entry) => {
                  if (entry.fileName === 'board.json') {
                    found = true
                    zipfile.openReadStream(entry, (err, stream) => {
                      if (err || !stream) { resolve(''); return }
                      const chunks: Buffer[] = []
                      stream.on('data', c => chunks.push(c))
                      stream.on('end', () => {
                        zipfile.close()
                        resolve(Buffer.concat(chunks).toString('utf-8'))
                      })
                    })
                  } else { zipfile.readEntry() }
                })
                zipfile.on('end', () => { if (!found) resolve(''); zipfile.close() })
              })
            })

            if (boardDataRaw) {
              const parsed = JSON.parse(boardDataRaw)
              // If it's our direct AppNote format inside the zip
              if (parsed && parsed.id) {
                results.push({
                  ...parsed,
                  fileName: f,
                  isTrash,
                  lastModified: fs.statSync(fullPath).mtimeMs
                })
              } else {
                // Legacy board format: synthesize metadata from filename/parsed fields
                const boardId = f.endsWith('.board') ? f.replace('.board', '') : f.replace('.ibo', '')
                results.push({
                  id: boardId,
                  title: parsed.title || 'Untitled Board',
                  type: 'board',
                  projectId: projectId,
                  fileName: f,
                  isTrash,
                  lastModified: fs.statSync(fullPath).mtimeMs
                })
              }
            }
          }
        } catch (e) {
          console.error('Error scanning file:', fullPath, e)
        }
      }
      return results
    }

    // 1. Scan root notes + boards (and their trash subdirectories)
    const rootNotes = await scanDir(join(workspacePath, 'notes'), 'default', 'markdown')
    const rootBoards = await scanDir(join(workspacePath, 'boards'), 'default', 'board')
    const rootNotesTrash = await scanDir(join(workspacePath, 'notes', 'trash'), 'default', 'markdown', true)
    const rootBoardsTrash = await scanDir(join(workspacePath, 'boards', 'trash'), 'default', 'board', true)
    allNotes.push(...rootNotes, ...rootBoards, ...rootNotesTrash, ...rootBoardsTrash)

    // 2. Scan projects (and their trash subdirectories)
    for (const p of projects) {
      const pNotes = await scanDir(join(workspacePath, p, 'notes'), p, 'markdown')
      const pBoards = await scanDir(join(workspacePath, p, 'boards'), p, 'board')
      const pNotesTrash = await scanDir(join(workspacePath, p, 'notes', 'trash'), p, 'markdown', true)
      const pBoardsTrash = await scanDir(join(workspacePath, p, 'boards', 'trash'), p, 'board', true)
      allNotes.push(...pNotes, ...pBoards, ...pNotesTrash, ...pBoardsTrash)
    }

    // 3. Deduplicate by ID (keep latest)
    const uniqueNotes = new Map<string, any>()
    for (const n of allNotes) {
      const existing = uniqueNotes.get(n.id)
      if (!existing || n.lastModified > existing.lastModified) {
        uniqueNotes.set(n.id, n)
      }
    }

    return Array.from(uniqueNotes.values())
  } catch (error) {
    console.error('Failed to scan workspace notes:', error)
    return []
  }
})

ipcMain.handle('app:openExternal', async (_, url: string) => {
  await shell.openExternal(url)
})

ipcMain.handle('app:openPath', async (_, filePath: string) => {
  console.log('[main] app:openPath request for:', filePath)
  
  if (!filePath) return 'Path is empty'
  
  const normalizedPath = path.normalize(filePath)
  
  // 1. Check if exists
  if (!fs.existsSync(normalizedPath)) {
    console.error('[main] File does not exist:', normalizedPath)
    return 'File or folder does not exist at this location.'
  }

  try {
    // 2. Try Standard Open
    const result = await shell.openPath(normalizedPath)
    if (!result) {
      console.log('[main] openPath success')
      return ''
    }
    
    console.log('[main] openPath failed, trying fallback:', result)
    
    // 3. Try URI Fallback (Sometimes works when openPath fails due to formatting)
    // We encode the path for URI
    const fileUrl = `file://${normalizedPath.replace(/\\/g, '/')}`
    await shell.openExternal(fileUrl)
    console.log('[main] openExternal success')
    return ''
  } catch (err: any) {
    console.warn('[main] Opening failed, trying folder fallback:', err)
    // 4. Final Fallback: Just show in folder
    try {
      shell.showItemInFolder(normalizedPath)
      return 'Could not open file directly, showing in folder instead.'
    } catch (finalErr: any) {
      return `Critical error opening file: ${finalErr.message || finalErr}`
    }
  }
})

ipcMain.handle('app:selectFile', async (event) => {
  const win = BrowserWindow.fromWebContents(event.sender)
  console.log('[main] app:selectFile called from win:', !!win)
  try {
    const result = await dialog.showOpenDialog(win!, {
      properties: ['openFile'],
      title: 'Select a file to attach'
    })
    console.log('[main] showOpenDialog result:', result)
    if (!result.canceled && result.filePaths.length > 0) {
      return result.filePaths[0]
    }
  } catch (err) {
    console.error('[main] showOpenDialog error:', err)
  }
  return null
})

ipcMain.handle('app:selectFolder', async (event) => {
  const win = BrowserWindow.fromWebContents(event.sender)
  try {
    const result = await dialog.showOpenDialog(win!, {
      properties: ['openDirectory'],
      title: 'Select a folder to attach'
    })
    if (!result.canceled && result.filePaths.length > 0) {
      return result.filePaths[0]
    }
  } catch (err) {
    console.error('[main] app:selectFolder error:', err)
  }
  return null
})

ipcMain.handle('workspace:getFolderSize', async (_, folderPath: string) => {
  const getDirSize = (dir: string): number => {
    let size = 0
    try {
      if (!fs.existsSync(dir)) return 0
      const files = fs.readdirSync(dir)
      for (const file of files) {
        const filePath = join(dir, file)
        const stats = fs.statSync(filePath)
        if (stats.isDirectory()) {
          size += getDirSize(filePath)
        } else {
          size += stats.size
        }
      }
    } catch (error) {
      console.error('Error calculating folder size for:', dir, error)
    }
    return size
  }
  return getDirSize(folderPath)
})

ipcMain.handle('store:get', (_, key) => {
  return store.get(key)
})

ipcMain.handle('store:set', (_, key, value) => {
  store.set(key, value)
})

// Markdown Notes File System API
ipcMain.handle('notes:getDefaultDir', () => {
  const defaultDir = join(app.getPath('userData'), 'Notes')
  if (!fs.existsSync(defaultDir)) {
    fs.mkdirSync(defaultDir, { recursive: true })
  }
  return defaultDir
})

ipcMain.handle('notes:selectDirectory', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ['openDirectory', 'createDirectory']
  })
  if (!canceled && filePaths.length > 0) {
    return filePaths[0]
  }
  return null
})

ipcMain.handle('notes:read', (_, dirPath: string, fileName: string) => {
  try {
    const filePath = join(dirPath, fileName)
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath, 'utf-8')
    }
  } catch (error) {
    console.error('Failed to read note:', error)
  }
  return null
})

ipcMain.handle('notes:save', (_, dirPath: string, fileName: string, noteData: any) => {
  try {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true })
    }
    const filePath = join(dirPath, fileName)
    let fileContent = ''

    if (fileName.endsWith('.md') && typeof noteData === 'object') {
      const { content, ...metadata } = noteData
      fileContent = matter.stringify(content || '', metadata)
    } else {
      fileContent = typeof noteData === 'string' ? noteData : JSON.stringify(noteData, null, 2)
    }

    fs.writeFileSync(filePath, fileContent, 'utf-8')
    return true
  } catch (error) {
    console.error('Failed to save note:', error)
    return false
  }
})

ipcMain.handle('notes:delete', (_, dirPath: string, fileName: string) => {
  try {
    const filePath = join(dirPath, fileName)
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath)
    }
    return true
  } catch (error) {
    console.error('Failed to delete note:', error)
    return false
  }
})

ipcMain.handle('notes:rename', (_, dirPath: string, oldFileName: string, newFileName: string) => {
  try {
    const oldPath = join(dirPath, oldFileName)
    const newPath = join(dirPath, newFileName)
    if (fs.existsSync(oldPath) && oldPath !== newPath) {
      if (fs.existsSync(newPath)) {
        // Only overwrite if it's a case-insensitive match (same note, different casing)
        // Otherwise skip to avoid silently destroying a different note's file
        if (oldPath.toLowerCase() === newPath.toLowerCase()) {
          // Case change on case-insensitive FS: use temp file to avoid conflicts
          const tempPath = oldPath + '.tmp_rename'
          fs.renameSync(oldPath, tempPath)
          fs.renameSync(tempPath, newPath)
          return true
        } else {
          console.warn('[notes:rename] Target file already exists, skipping to avoid data loss:', newPath)
          return false
        }
      }
      fs.renameSync(oldPath, newPath)
    }
    return true
  } catch (error) {
    console.error('Failed to rename note:', error)
    return false
  }
})

ipcMain.handle('notes:move', (_, oldDir: string, newDir: string, fileName: string) => {
  try {
    const oldPath = join(oldDir, fileName)
    const newPath = join(newDir, fileName)

    if (fs.existsSync(oldPath)) {
      if (!fs.existsSync(newDir)) {
        fs.mkdirSync(newDir, { recursive: true })
      }
      fs.renameSync(oldPath, newPath)
    }
    return true
  } catch (error) {
    console.error('Failed to move note:', error)
    return false
  }
})

ipcMain.handle('projects:selectFile', async (_, type: 'save' | 'open') => {
  if (type === 'save') {
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: 'Export Projects and Tasks',
      defaultPath: 'projects-backup.json',
      filters: [{ name: 'JSON', extensions: ['json'] }]
    })
    return canceled ? null : filePath
  } else {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: 'Import Projects and Tasks',
      properties: ['openFile'],
      filters: [{ name: 'JSON', extensions: ['json'] }]
    })
    return canceled ? null : filePaths[0]
  }
})

ipcMain.handle('projects:export', (_, filePath: string, data: string) => {
  try {
    fs.writeFileSync(filePath, data, 'utf-8')
    return true
  } catch (error) {
    console.error('Failed to export projects:', error)
    return false
  }
})

ipcMain.handle('projects:import', (_, filePath: string) => {
  try {
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath, 'utf-8')
    }
  } catch (error) {
    console.error('Failed to import projects:', error)
  }
  return null
})

ipcMain.handle('notes:list', (_, dirPath: string) => {
  try {
    if (!fs.existsSync(dirPath)) return []
    const files = fs
      .readdirSync(dirPath)
      .filter((f: string) => f.endsWith('.md') || f.endsWith('.tldr'))
    return files.map((f: string) => {
      const content = fs.readFileSync(join(dirPath, f), 'utf-8')
      const ext = f.endsWith('.md') ? '.md' : '.tldr'
      const id = f.replace(ext, '')
      const type = ext === '.md' ? 'markdown' : 'board'

      let title = id
      if (type === 'markdown') {
        const firstLine = content
          .split('\n')[0]
          ?.replace(/^#+\s*/, '')
          .trim()
        if (firstLine) title = firstLine
      } else {
        try {
          const parsed = JSON.parse(content)
          if (parsed && parsed.title) title = parsed.title
        } catch (e) {
          // invalid json or empty file, ignore
        }
      }

      return {
        id,
        title,
        content,
        type,
        lastModified: fs.statSync(join(dirPath, f)).mtimeMs
      }
    })
  } catch (error) {
    console.error('Failed to list notes:', error)
    return []
  }
})

// Boards API
ipcMain.handle('boards:list', async (_, dirPath: string) => {
  try {
    if (!fs.existsSync(dirPath)) return []
    const files = fs
      .readdirSync(dirPath)
      .filter((f: string) => f.endsWith('.board') || f.endsWith('.ibo'))

    const results: any[] = []
    for (const f of files) {
      const fullPath = join(dirPath, f)
      let content = ''
      let id = ''
      const type = 'board'

      if (f.endsWith('.ibo')) {
        id = f.replace('.ibo', '')
        try {
          const zipData = fs.readFileSync(fullPath)
          const zip = await JSZip.loadAsync(zipData)
          const jsonFile = zip.file('board.json')
          if (jsonFile) {
            content = await jsonFile.async('string')
          }
        } catch (e) { console.error('Error reading .ibo list entry:', e) }
      } else {
        id = f.replace('.board', '')
        const buffer = Buffer.alloc(4)
        try {
          const fd = fs.openSync(fullPath, 'r')
          fs.readSync(fd, buffer, 0, 4, null)
          fs.closeSync(fd)
          
          if (buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04) {
            content = await new Promise<string>((resolve) => {
              yauzl.open(fullPath, { lazyEntries: true }, (err, zipfile) => {
                if (err || !zipfile) { resolve(''); return }
                
                let found = false
                zipfile.readEntry()
                zipfile.on('entry', (entry) => {
                  if (entry.fileName === 'board.json') {
                    found = true
                    zipfile.openReadStream(entry, (err, stream) => {
                      if (err || !stream) { resolve(''); return }
                      const chunks: Buffer[] = []
                      stream.on('data', c => chunks.push(c))
                      stream.on('end', () => {
                        zipfile.close()
                        resolve(Buffer.concat(chunks).toString('utf-8'))
                      })
                    })
                  } else {
                    zipfile.readEntry()
                  }
                })
                zipfile.on('end', () => {
                  if (!found) resolve('')
                  zipfile.close()
                })
              })
            })
          } else {
            content = fs.readFileSync(fullPath, 'utf-8')
          }
        } catch (e) {
          content = ''
        }
      }

      let title = 'Untitled Board'
      try {
        const parsed = JSON.parse(content)
        if (parsed && parsed.title) title = parsed.title
      } catch {
        // ignore
      }

      results.push({
        id,
        title,
        content,
        type,
        lastModified: fs.statSync(fullPath).mtimeMs
      })
    }
    return results
  } catch (error) {
    console.error('Failed to list boards:', error)
    return []
  }
})

ipcMain.handle('boards:read', (_, dirPath: string, fileName: string) => {
  try {
    const filePath = join(dirPath, fileName)
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath, 'utf-8')
    }
  } catch (error) {
    console.error('Failed to read board:', error)
  }
  return null
})

ipcMain.handle('boards:save', (_, dirPath: string, fileName: string, content: string) => {
  try {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true })
    }
    const filePath = join(dirPath, fileName)
    fs.writeFileSync(filePath, content, 'utf-8')
    return true
  } catch (error) {
    console.error('Failed to save board:', error)
    return false
  }
})

ipcMain.handle('boards:delete', (_, dirPath: string, fileName: string) => {
  try {
    const filePath = join(dirPath, fileName)
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath)
    }
    return true
  } catch (error) {
    console.error('Failed to delete board:', error)
    return false
  }
})

ipcMain.handle('boards:move', (_, oldDir: string, newDir: string, fileName: string) => {
  try {
    const oldPath = join(oldDir, fileName)
    const newPath = join(newDir, fileName)

    if (fs.existsSync(oldPath)) {
      if (!fs.existsSync(newDir)) {
        fs.mkdirSync(newDir, { recursive: true })
      }
      fs.renameSync(oldPath, newPath)
    }
    return true
  } catch (error) {
    console.error('Failed to move board:', error)
    return false
  }
})

ipcMain.handle(
  'boards:save-container',
  async (_, dirPath: string, fileName: string, boardContent: any) => {
    try {
      const containerPath = join(dirPath, fileName)
      const tmpPath = containerPath + '.tmp'

      let parsed: any = { elements: [], viewport: { x: 0, y: 0, scale: 1 } }
      if (typeof boardContent === 'string') {
        if (boardContent && boardContent.trim()) {
          try { parsed = JSON.parse(boardContent) } catch (e) { console.error('JSON err:', e) }
        }
      } else {
        parsed = boardContent
      }

      const elements = parsed.elements || []

      // Backup old archive to prevent reading from a locked file while overwriting
      let sourceArchive = containerPath
      const oldExists = await fs.promises.access(containerPath).then(() => true).catch(() => false)
      if (oldExists) {
        sourceArchive = containerPath + '.old'
        // If an old .old exists from a crash, remove it
        await fs.promises.access(sourceArchive).then(() => fs.promises.unlink(sourceArchive)).catch(() => {})
        await fs.promises.rename(containerPath, sourceArchive)
      }

      const zipfile = new yazl.ZipFile()
      const writeStream = fs.createWriteStream(tmpPath)
      zipfile.outputStream.pipe(writeStream)

      // Keep track of which assets are provided natively vs migrating
      const providedAssets = new Set<string>()

      for (const el of elements) {
        if ((el.type !== 'image' && el.type !== 'video') || !el.url) continue

        if (el.url.startsWith('data:')) {
          const commaIndex = el.url.indexOf(',')
          if (commaIndex !== -1) {
            const mimePart = el.url.substring(0, commaIndex)
            const base64Data = el.url.substring(commaIndex + 1)
            const buffer = Buffer.from(base64Data, 'base64')
            const mimeMatch = mimePart.match(/data:(.*?);/)
            const ext = mimeMatch ? mimeMatch[1].split('/')[1] : 'png'
            const assetName = `${el.id}.${ext}`
            const relativePath = `assets/${assetName}`

            zipfile.addBuffer(buffer, relativePath, { compress: false })
            providedAssets.add(relativePath)
            el.url = relativePath
          }
        } else if (el.url.startsWith('file:///')) {
          let sourcePath = el.url.replace('file:///', '')
          try { sourcePath = decodeURIComponent(sourcePath) } catch (e) {}

          const fileExists = await fs.promises.access(sourcePath).then(() => true).catch(() => false)
          if (fileExists) {
            const ext = path.extname(sourcePath) || '.png'
            const assetName = `${el.id}${ext}`
            const relativePath = `assets/${assetName}`

            zipfile.addFile(sourcePath, relativePath, { compress: false })
            providedAssets.add(relativePath)
            el.url = relativePath
          }
        } else if (el.url.startsWith('board-asset://')) {
          const url = new URL(el.url)
          el.url = `assets/${url.pathname.replace(/^\/+/, '')}`
        }
      }

      // Wrap everything in the consolidated format if boardContent was the full note object
      let internalData = parsed
      if (boardContent && typeof boardContent === 'object' && boardContent.id) {
         // It's the full AppNote. The board canvas data is in boardContent.content
         const canvasData = typeof boardContent.content === 'string' ? JSON.parse(boardContent.content) : boardContent.content
         internalData = {
           ...boardContent,
           ...canvasData // Merge elements and viewport into the root of board.json
         }
      }

      zipfile.addBuffer(Buffer.from(JSON.stringify(internalData, null, 2), 'utf-8'), 'board.json')

      // Migrate existing untouched assets from old archive
      if (oldExists) {
        const referencedAssets = new Set(elements.map((e: any) => e.url).filter((u: string) => u?.startsWith('assets/')))
        
        await new Promise<void>((resolve, reject) => {
          yauzl.open(sourceArchive, { lazyEntries: true }, (err, oldZip) => {
            if (err || !oldZip) { resolve(); return }
            
            oldZip.readEntry()
            oldZip.on('entry', (entry) => {
              if (
                entry.fileName.startsWith('assets/') && 
                referencedAssets.has(entry.fileName) && 
                !providedAssets.has(entry.fileName)
              ) {
                oldZip.openReadStream(entry, (err, readStream) => {
                  if (err) { oldZip.readEntry(); return }
                  zipfile.addReadStream(readStream, entry.fileName, { compress: false })
                  readStream.on('end', () => oldZip.readEntry())
                })
              } else {
                oldZip.readEntry()
              }
            })
            oldZip.on('end', () => { oldZip.close(); resolve() })
            oldZip.on('error', (e) => reject(e))
          })
        }).catch(err => console.error('Error migrating old zip:', err))
      }

      await new Promise<void>((resolve, reject) => {
        zipfile.end()
        writeStream.on('close', resolve)
        writeStream.on('error', reject)
      })

      // Replace and cleanup
      await fs.promises.rename(tmpPath, containerPath)
      if (oldExists) {
        // give it a tiny delay to ensure file lock is released by Windows
        setTimeout(() => { fs.promises.unlink(sourceArchive).catch(() => {}) }, 50)
      }

      // Restore absolute board-asset URLs for UI
      for (const el of elements) {
        if (el.url && el.url.startsWith('assets/')) {
          const assetId = el.url.replace('assets/', '')
          el.url = `board-asset://${assetId}?container=${encodeURIComponent(containerPath)}`
        }
      }

      return JSON.stringify(parsed)
    } catch (error) {
      console.error('Failed to save container:', error)
      return null
    }
  }
)

ipcMain.handle('boards:load-container', async (_, dirPath: string, fileName: string) => {
  try {
    const containerPath = join(dirPath, fileName)
    const exists = await fs.promises.access(containerPath).then(() => true).catch(() => false)
    if (!exists) return null

    const boardDataRaw = await new Promise<string>((resolve, reject) => {
      yauzl.open(containerPath, { lazyEntries: true }, (err, zipfile) => {
        if (err || !zipfile) { reject(err); return }
        
        let found = false
        zipfile.readEntry()
        zipfile.on('entry', (entry) => {
          if (entry.fileName === 'board.json') {
            found = true
            zipfile.openReadStream(entry, (err, stream) => {
              if (err || !stream) { reject(err); return }
              const chunks: Buffer[] = []
              stream.on('data', c => chunks.push(c))
              stream.on('end', () => {
                zipfile.close()
                resolve(Buffer.concat(chunks).toString('utf-8'))
              })
              stream.on('error', reject)
            })
          } else {
            zipfile.readEntry()
          }
        })
        zipfile.on('end', () => {
          if (!found) reject(new Error('board.json not found in container'))
          zipfile.close()
        })
      })
    })

    const boardData = JSON.parse(boardDataRaw)
    const elements = boardData.elements || []

    // Convert relative zipped assets to the virtual streaming protocol URL
    for (const el of elements) {
      if (el.url && (el.url.startsWith('assets/') || el.url.startsWith('media/'))) {
        const assetId = el.url.replace('assets/', '').replace('media/', '')
        el.url = `board-asset://${assetId}?container=${encodeURIComponent(containerPath)}`
      }
    }

    return JSON.stringify(boardData)
  } catch (error) {
    console.error('Failed to read .board container:', error)
    return null
  }
})

ipcMain.handle(

  'boards:saveIbo',
  async (_, dirPath: string, fileName: string, boardContent: string) => {
    try {
      const containerPath = join(dirPath, fileName)

      // Ensure container directory exists (Async)
      const containerExists = await fs.promises
        .access(containerPath)
        .then(() => true)
        .catch(() => false)
      if (!containerExists) {
        await fs.promises.mkdir(containerPath, { recursive: true })
      }

      const mediaDirPath = join(containerPath, 'media')
      const mediaExists = await fs.promises
        .access(mediaDirPath)
        .then(() => true)
        .catch(() => false)
      if (!mediaExists) {
        await fs.promises.mkdir(mediaDirPath, { recursive: true })
      }

      let parsed: any = { elements: [], viewport: { x: 0, y: 0, scale: 1 } }
      if (boardContent && boardContent.trim()) {
        try {
          parsed = JSON.parse(boardContent)
        } catch (e) {
          console.error('Parse error in saveIbo:', e)
        }
      }

      const elements = parsed.elements || []

      // Process all elements in parallel for maximum speed
      await Promise.all(
        elements.map(async (el: any) => {
          if ((el.type !== 'image' && el.type !== 'video') || !el.url) return

          // 1. Efficient Base64 handling
          if (el.url.startsWith('data:')) {
            const commaIndex = el.url.indexOf(',')
            if (commaIndex !== -1) {
              const mimePart = el.url.substring(0, commaIndex)
              const base64Data = el.url.substring(commaIndex + 1)
              const buffer = Buffer.from(base64Data, 'base64')

              const mimeMatch = mimePart.match(/data:(.*?);/)
              const ext = mimeMatch ? mimeMatch[1].split('/')[1] : 'png'
              const assetName = `${el.id}.${ext}`

              await fs.promises.writeFile(join(mediaDirPath, assetName), buffer)
              el.url = `media/${assetName}`
            }
          }
          // 2. Handle Absolute Local Files
          else if (el.url.startsWith('file:///')) {
            let sourcePath = el.url.replace('file:///', '')
            try {
              sourcePath = decodeURIComponent(sourcePath)
            } catch (e) {}

            const fileExists = await fs.promises
              .access(sourcePath)
              .then(() => true)
              .catch(() => false)
            if (fileExists) {
              const ext = path.extname(sourcePath) || '.png'
              const assetName = `${el.id}${ext}`
              const destPath = join(mediaDirPath, assetName)

              if (sourcePath !== destPath) {
                await fs.promises.copyFile(sourcePath, destPath)
              }
              el.url = `media/${assetName}`
            }
          }
        })
      )

      // Save the JSON (Async)
      await fs.promises.writeFile(
        join(containerPath, 'board.json'),
        JSON.stringify(parsed, null, 2),
        'utf-8'
      )

      return JSON.stringify(parsed)
    } catch (error) {
      console.error('Failed to save .ibo container:', error)
      return null
    }
  }
)

ipcMain.handle('boards:readIbo', async (_, dirPath: string, fileName: string) => {
  try {
    const containerPath = join(dirPath, fileName)
    if (!fs.existsSync(containerPath)) return null

    // Fallback for legacy ZIP format
    if (fs.statSync(containerPath).isFile()) {
      const zipData = fs.readFileSync(containerPath)
      const zip = await JSZip.loadAsync(zipData)
      const jsonFile = zip.file('board.json')
      if (!jsonFile) return null
      const raw = await jsonFile.async('string')
      const boardData = JSON.parse(raw)

      // Migrate assets from ZIP to temp folder for display
      const tempDir = join(app.getPath('userData'), 'ibo_temp', fileName.replace('.ibo', ''))
      if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true })

      const elements = boardData.elements || []
      for (const el of elements) {
        if (el.url && el.url.startsWith('media/')) {
          const zipFile = zip.file(el.url)
          if (zipFile) {
            const data = await zipFile.async('nodebuffer')
            const localPath = join(tempDir, path.basename(el.url))
            fs.writeFileSync(localPath, data)
            el.url = `file:///${localPath.replace(/\\/g, '/')}`
          }
        }
      }
      return JSON.stringify(boardData)
    }

    // Modern Directory format
    const jsonPath = join(containerPath, 'board.json')
    if (!fs.existsSync(jsonPath)) return null

    const content = fs.readFileSync(jsonPath, 'utf-8')
    const boardData = JSON.parse(content)

    // Convert relative media/ paths to absolute file:/// URLs for renderer
    const elements = boardData.elements || []
    for (const el of elements) {
      if (el.url && el.url.startsWith('media/')) {
        const fullAssetPath = join(containerPath, el.url)
        el.url = `file:///${fullAssetPath.replace(/\\/g, '/')}`
      }
    }

    return JSON.stringify(boardData)
  } catch (error) {
    console.error('Failed to read .ibo container:', error)
    return null
  }
})

ipcMain.handle(
  'boards:saveAsset',
  async (_, dirPath: string, fileName: string, assetId: string, assetData: string) => {
    try {
      const containerPath = join(dirPath, fileName)
      const mediaDirPath = join(containerPath, 'media')

      // Use async access instead of existsSync
      const exists = await fs.promises
        .access(mediaDirPath)
        .then(() => true)
        .catch(() => false)
      if (!exists) {
        await fs.promises.mkdir(mediaDirPath, { recursive: true })
      }

      let assetName = ''
      let buffer: Buffer | null = null

      if (assetData.startsWith('data:')) {
        const commaIndex = assetData.indexOf(',')
        if (commaIndex !== -1) {
          const mimePart = assetData.substring(0, commaIndex)
          const base64Data = assetData.substring(commaIndex + 1)
          buffer = Buffer.from(base64Data, 'base64')

          const mimeMatch = mimePart.match(/data:(.*?);/)
          const ext = mimeMatch ? mimeMatch[1].split('/')[1] : 'png'
          assetName = `${assetId}.${ext}`
        }
      } else if (assetData.startsWith('file:///')) {
        let sourcePath = assetData.replace('file:///', '')
        try {
          sourcePath = decodeURIComponent(sourcePath)
        } catch (e) {}

        const fileExists = await fs.promises
          .access(sourcePath)
          .then(() => true)
          .catch(() => false)
        if (fileExists) {
          const ext = path.extname(sourcePath) || '.png'
          assetName = `${assetId}${ext}`
          await fs.promises.copyFile(sourcePath, join(mediaDirPath, assetName))
        }
      }

      if (assetName && (buffer || assetData.startsWith('file:///'))) {
        const targetPath = join(mediaDirPath, assetName)
        if (buffer) {
          // Fire and forget? No, let's wait but ensure it's async
          await fs.promises.writeFile(targetPath, buffer)
        }
        return {
          url: `media/${assetName}`,
          fullPath: `file:///${targetPath.replace(/\\/g, '/')}`
        }
      }
      return null
    } catch (error) {
      console.error('Failed to save asset:', error)
      return null
    }
  }
)

ipcMain.on('notification:show', (_, title, body) => {
  new Notification({ title, body, icon: globalIconPath }).show()
  // Notify renderer windows for the internal Notification Center
  BrowserWindow.getAllWindows().forEach((win) => {
    if (!win.isDestroyed()) {
      win.webContents.send('on-timer-finished', 'timer-id-placeholder', body)
    }
  })
})

ipcMain.handle('window:toggleAlwaysOnTop', (event, flag) => {
  const win = BrowserWindow.fromWebContents(event.sender)
  if (win) {
    win.setAlwaysOnTop(flag, 'floating')
  }
})

// ---- Custom Resize for transparent frameless window ----
let resizeInterval: ReturnType<typeof setInterval> | null = null

ipcMain.on('window:resizeStart', (event, direction: string) => {
  const win = BrowserWindow.fromWebContents(event.sender)
  if (!win) return

  const startBounds = win.getBounds()
  const startMouse = screen.getCursorScreenPoint()
  const MIN_W = 380
  const MIN_H = 300

  if (resizeInterval) clearInterval(resizeInterval)
  resizeInterval = setInterval(() => {
    if (!win || win.isDestroyed()) {
      if (resizeInterval) clearInterval(resizeInterval)
      return
    }
    const cur = screen.getCursorScreenPoint()
    const dx = cur.x - startMouse.x
    const dy = cur.y - startMouse.y
    let { x, y, width, height } = startBounds

    if (direction.includes('e')) width = Math.max(MIN_W, startBounds.width + dx)
    if (direction.includes('s')) height = Math.max(MIN_H, startBounds.height + dy)
    if (direction.includes('w')) {
      width = Math.max(MIN_W, startBounds.width - dx)
      x = startBounds.x + startBounds.width - width
    }
    if (direction.includes('n')) {
      height = Math.max(MIN_H, startBounds.height - dy)
      y = startBounds.y + startBounds.height - height
    }
    win.setBounds({
      x: Math.round(x),
      y: Math.round(y),
      width: Math.round(width),
      height: Math.round(height)
    })
  }, 16)
})

ipcMain.on('window:resizeEnd', () => {
  if (resizeInterval) {
    clearInterval(resizeInterval)
    resizeInterval = null
  }
})

ipcMain.on('window:minimize', (event) => {
  BrowserWindow.fromWebContents(event.sender)?.minimize()
})

ipcMain.on('window:maximize', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender)
  if (!win) return
  if (win.isMaximized()) {
    win.unmaximize()
  } else {
    win.maximize()
  }
})

ipcMain.on('window:close', (event) => {
  BrowserWindow.fromWebContents(event.sender)?.hide()
})

// Mini-Window Management
ipcMain.on('create-mini-window', (_, timerId: string) => {
  if (miniWindows[timerId]) {
    miniWindows[timerId].focus()
    return
  }

  const miniWin = new BrowserWindow({
    width: 280,
    height: 220,
    alwaysOnTop: true,
    frame: false,
    backgroundColor: '#0A0A0A',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      webSecurity: false,
      backgroundThrottling: false
    }
  })

  miniWindows[timerId] = miniWin

  // Route event back to main window when mini-window closes (unpin)
  miniWin.on('closed', () => {
    if (miniWindows[timerId]) {
      delete miniWindows[timerId]
    }
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('mini-window-closed', timerId)
    }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    miniWin.loadURL(`${process.env['ELECTRON_RENDERER_URL']}?mini=${timerId}`)
  } else {
    miniWin.loadFile(join(__dirname, '../renderer/index.html'), { search: `mini=${timerId}` })
  }
})

ipcMain.on('close-mini-window', (_, timerId: string) => {
  if (miniWindows[timerId]) {
    const win = miniWindows[timerId]
    delete miniWindows[timerId] // remove reference immediately
    win.destroy() // forcefully destroy to avoid React rendering callbacks during close
  }
})

// State synchronization between Main Window and Mini Windows
ipcMain.on('sync-timer-state', (_, timerId: string, state: any) => {
  BrowserWindow.getAllWindows().forEach((win) => {
    if (!win.isDestroyed()) {
      win.webContents.send('on-sync-timer-state', timerId, state)
    }
  })
})

ipcMain.on('action-timer', (_, timerId: string, action: string) => {
  if (mainWindow) {
    mainWindow.webContents.send('on-action-timer', timerId, action)
  }
})

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'board-asset',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      bypassCSP: true,
      stream: true
    }
  }
])

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.antigravity.cluster')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  protocol.handle('board-asset', async (req) => {
    try {
      const url = new URL(req.url)
      const containerPath = url.searchParams.get('container')
      // e.g. board-asset://some-id.png -> path is /some-id.png
      const targetSubPath = `assets/${url.pathname.replace(/^\/+/, '')}`

      if (!containerPath || !fs.existsSync(containerPath)) {
        return new Response('Container not found', { status: 404 })
      }

      return await new Promise<Response>((resolve) => {
        yauzl.open(containerPath, { lazyEntries: true }, (err, zipfile) => {
          if (err || !zipfile) {
            resolve(new Response('Failed to open zip', { status: 500 }))
            return
          }

          let found = false

          zipfile.readEntry()
          zipfile.on('entry', (entry) => {
            if (entry.fileName === targetSubPath) {
              found = true
              zipfile.openReadStream(entry, (err, stream) => {
                if (err || !stream) {
                  zipfile.close()
                  resolve(new Response('Archive read error', { status: 500 }))
                  return
                }

                const ext = path.extname(entry.fileName).toLowerCase()
                let contentType = 'application/octet-stream'
                if (ext === '.png') contentType = 'image/png'
                else if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg'
                else if (ext === '.gif') contentType = 'image/gif'
                else if (ext === '.webp') contentType = 'image/webp'
                else if (ext === '.svg') contentType = 'image/svg+xml'

                const webStream = Readable.toWeb(stream)
                stream.on('end', () => zipfile.close())

                resolve(new Response(webStream as any, { 
                  headers: { 'Content-Type': contentType } 
                }))
              })
            } else {
              zipfile.readEntry()
            }
          })

          zipfile.on('end', () => {
            if (!found) {
              resolve(new Response('Not found', { status: 404 }))
            }
            zipfile.close()
          })
        })
      })
    } catch (e) {
      console.error('board-asset protocol error:', e)
      return new Response('Internal error', { status: 500 })
    }
  })

  createWindow()

  // Create Tray Icon (destroy previous if exists, e.g. after HMR restart)
  if (appTray) {
    appTray.destroy()
    appTray = null
  }

  let trayIcon
  try {
    trayIcon = nativeImage.createFromPath(globalIconPath)
  } catch (e) {
    console.error(e)
  }

  appTray = new Tray(trayIcon || nativeImage.createEmpty())
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Open',
      click: () => {
        if (mainWindow) mainWindow.show()
      }
    },
    {
      label: 'Quit',
      click: () => {
        ;(app as any).isQuiting = true
        app.quit()
      }
    }
  ])
  appTray.setToolTip('Cluster')
  appTray.setContextMenu(contextMenu)

  appTray.on('click', () => {
    if (mainWindow) mainWindow.show()
  })

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
