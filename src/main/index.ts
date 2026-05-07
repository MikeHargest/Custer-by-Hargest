import { app, shell, BrowserWindow, ipcMain, dialog, Notification, screen, protocol, Tray, Menu, nativeImage, safeStorage } from 'electron'
import path, { join } from 'path'
import fs from 'fs'
import { syncManager } from './googleSyncManager'
import { Readable } from 'stream'
import JSZip from 'jszip'
import yauzl from 'yauzl'
import yazl from 'yazl'
import { google } from 'googleapis'
import http from 'http'
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
    minWidth: 900,
    minHeight: 600,
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
      join(projectDir, 'overview'),
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

ipcMain.handle('workspace:writeJson', async (_, filePath: string, data: any) => {
  try {
    const content = JSON.stringify(data, null, 2)
    const folder = join(filePath, '..')
    if (!fs.existsSync(folder)) {
      fs.mkdirSync(folder, { recursive: true })
    }
    await writeWithRetry(filePath, content)
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

// Helper to safely write files despite temporary antivirus/sync locks
const writeWithRetry = async (filePath: string, content: string, retries = 3, delayMs = 500): Promise<void> => {
  for (let i = 0; i < retries; i++) {
    try {
      fs.writeFileSync(filePath, content, 'utf-8')
      return
    } catch (err: any) {
      if ((err.code === 'EBUSY' || err.code === 'EPERM') && i < retries - 1) {
        await new Promise(r => setTimeout(r, delayMs))
      } else {
        throw err
      }
    }
  }
}

// Helper to safely rename files
const renameWithRetry = async (oldPath: string, newPath: string, retries = 3, delayMs = 500): Promise<void> => {
  for (let i = 0; i < retries; i++) {
    try {
      fs.renameSync(oldPath, newPath)
      return
    } catch (err: any) {
      if ((err.code === 'EBUSY' || err.code === 'EPERM') && i < retries - 1) {
        await new Promise(r => setTimeout(r, delayMs))
      } else {
        throw err
      }
    }
  }
}

const hasZipSignature = (filePath: string): boolean => {
  try {
    if (!fs.existsSync(filePath)) return false
    const sig = Buffer.alloc(4)
    const fd = fs.openSync(filePath, 'r')
    fs.readSync(fd, sig, 0, 4, 0)
    fs.closeSync(fd)
    return sig[0] === 0x50 && sig[1] === 0x4b && sig[2] === 0x03 && sig[3] === 0x04
  } catch {
    return false
  }
}

const getLatestBoardBackupPath = (targetDir: string, originalFileName: string): string | null => {
  try {
    const folderName = originalFileName.replace(/\.(md|board|ibo)$/, '')
    const backupBaseDir = join(targetDir, '.backups', folderName)
    if (!fs.existsSync(backupBaseDir)) return null
    const files = fs.readdirSync(backupBaseDir).filter((f) => f.endsWith('.board') || f.endsWith('.ibo'))
    if (files.length === 0) return null
    const sorted = files
      .map((f) => ({
        path: join(backupBaseDir, f),
        ts: fs.statSync(join(backupBaseDir, f)).mtimeMs
      }))
      .sort((a, b) => b.ts - a.ts)
    return sorted[0]?.path || null
  } catch {
    return null
  }
}

const recoverBoardContainerFromRecovery = (dirPath: string, fileName: string): boolean => {
  const containerPath = join(dirPath, fileName)
  const candidates = [
    containerPath + '.replacing',
    containerPath + '.tmp',
    getLatestBoardBackupPath(dirPath, fileName)
  ].filter(Boolean) as string[]

  for (const candidate of candidates) {
    if (!fs.existsSync(candidate) || !hasZipSignature(candidate)) continue
    try {
      if (fs.existsSync(containerPath) && !hasZipSignature(containerPath)) {
        const corruptPath = `${containerPath}.corrupt.${Date.now()}`
        fs.renameSync(containerPath, corruptPath)
      }
      fs.copyFileSync(candidate, containerPath)
      console.warn(`[boards-recovery] Recovered board "${fileName}" from: ${candidate}`)
      return true
    } catch (e) {
      console.error('[boards-recovery] Failed to recover candidate:', candidate, e)
    }
  }
  return false
}

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
          
          // CRITICAL: Cleanup orphaned .tmp_rename files (from a crash during rename)
          if (f.endsWith('.tmp_rename')) {
            const recoveredPath = fullPath.replace('.tmp_rename', '')
            if (!fs.existsSync(recoveredPath)) {
              fs.renameSync(fullPath, recoveredPath)
            } else {
              fs.unlinkSync(fullPath)
            }
            continue // it will be picked up on the next scan or as its actual extension if it's earlier in the loop
          }
        } catch { continue }
        
        const isBoard = f.endsWith('.board') || f.endsWith('.ibo')
        const isNote = f.endsWith('.json') || f.endsWith('.md')

        if (type === 'markdown' && !isNote) continue
        if (type === 'board' && !isBoard) continue

        try {
          if (isNote) {
            const raw = fs.readFileSync(fullPath, 'utf-8')
            if (f.endsWith('.md')) {
              let parsedMatter: any = { data: {}, content: raw }
              try {
                parsedMatter = matter(raw)
              } catch (e) {
                console.warn('YAML Frontmatter parsing skipped for malformed file:', f)
              }
              
              let id = parsedMatter.data?.id
              let title = parsedMatter.data?.title
              const noteType = parsedMatter.data?.type || 'markdown'
              const noteProjectId = parsedMatter.data?.projectId || projectId || 'default'
              
              if (!id) {
                id = f.replace('.md', '')
                if (!title) {
                  const firstLine = parsedMatter.content.split('\n')[0]?.replace(/^#+\s*/, '').trim()
                  title = firstLine || id
                }
              }

              results.push({
                ...parsedMatter.data,
                id,
                title,
                type: noteType,
                projectId: noteProjectId,
                content: parsedMatter.content,
                fileName: f,
                isTrash,
                lastModified: fs.statSync(fullPath).mtimeMs
              })
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
              let parsed: any = null
              try {
                if (boardDataRaw.trim() === '') {
                  parsed = { id: f.replace('.board', '').replace('.ibo', ''), title: 'Recovered Board' }
                } else {
                  parsed = JSON.parse(boardDataRaw)
                }
              } catch (e) {
                console.warn('Failed to parse board data for', f, e)
                parsed = { id: f.replace('.board', '').replace('.ibo', ''), title: 'Recovered Board' }
              }

              // If it's our direct AppNote format inside the zip
              if (parsed && parsed.id) {
                results.push({
                  ...parsed,
                  fileName: f,
                  isTrash,
                  projectId: projectId, // Force projectId to match the physical directory
                  lastModified: fs.statSync(fullPath).mtimeMs
                })
              } else {
                // Legacy board format: synthesize metadata from filename/parsed fields
                const boardId = f.endsWith('.board') ? f.replace('.board', '') : f.replace('.ibo', '')
                results.push({
                  id: boardId,
                  title: (parsed && parsed.title) ? parsed.title : 'Untitled Board',
                  type: 'board',
                  projectId: projectId,
                  fileName: f,
                  isTrash,
                  lastModified: fs.statSync(fullPath).mtimeMs
                })
              }
            } else {
               // If completely empty zip or missing board.json
               const boardId = f.endsWith('.board') ? f.replace('.board', '') : f.replace('.ibo', '')
               results.push({
                  id: boardId,
                  title: 'Recovered Empty Board',
                  type: 'board',
                  projectId: projectId,
                  fileName: f,
                  isTrash,
                  lastModified: fs.statSync(fullPath).mtimeMs
                })
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

    // 2. Scan projects (and their trash subdirectories) recursively via workspace_data.json
    const projectTargets: { id: string, notesPath: string, boardsPath: string }[] = []
    try {
      const wDataPath = join(workspacePath, 'workspace_data.json')
      if (fs.existsSync(wDataPath)) {
        const wData = JSON.parse(fs.readFileSync(wDataPath, 'utf-8'))
        if (wData.projects) {
          const extractPaths = (projs: any[]) => {
            for (const p of projs) {
              const pPath = p.path || join(workspacePath, p.name)
              projectTargets.push({
                id: p.id,
                notesPath: p.notesPath || join(pPath, 'notes'),
                boardsPath: p.boardsPath || join(pPath, 'boards')
              })
              if (p.subprojects && Array.isArray(p.subprojects)) {
                extractPaths(p.subprojects)
              }
            }
          }
          extractPaths(wData.projects)
        }
      }
    } catch (e) {
      console.error('Failed to parse workspace_data.json for nested projects', e)
    }

    // Fallback if no workspace_data.json: fallback to first-level directories
    if (projectTargets.length === 0) {
      for (const p of projects) {
        projectTargets.push({
          id: p,
          notesPath: join(workspacePath, p, 'notes'),
          boardsPath: join(workspacePath, p, 'boards')
        })
      }
    }

    for (const target of projectTargets) {
      const pNotes = await scanDir(target.notesPath, target.id, 'markdown')
      const pBoards = await scanDir(target.boardsPath, target.id, 'board')
      const pNotesTrash = await scanDir(join(target.notesPath, 'trash'), target.id, 'markdown', true)
      const pBoardsTrash = await scanDir(join(target.boardsPath, 'trash'), target.id, 'board', true)
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

ipcMain.handle('app:readTextFile', async (_, filePath: string) => {
  try {
    if (!filePath) return null
    const normalizedPath = path.normalize(filePath)
    if (!fs.existsSync(normalizedPath)) return null
    return fs.readFileSync(normalizedPath, 'utf-8')
  } catch (err) {
    console.error('[main] app:readTextFile error:', err)
    return null
  }
})

ipcMain.handle('boards:selectImportFile', async (event) => {
  const win = BrowserWindow.fromWebContents(event.sender)
  try {
    const dialogOptions: Electron.OpenDialogOptions = {
      properties: ['openFile'],
      title: 'Select board file to import',
      filters: [
        { name: 'Board Files', extensions: ['board', 'ibo', 'zip'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    }
    const result = win
      ? await dialog.showOpenDialog(win, dialogOptions)
      : await dialog.showOpenDialog(dialogOptions)
    if (!result.canceled && result.filePaths.length > 0) {
      return result.filePaths[0]
    }
  } catch (err) {
    console.error('[main] boards:selectImportFile error:', err)
  }
  return null
})

ipcMain.handle('boards:importBoardFile', async (_, sourcePath: string, targetDir: string, targetFileName: string) => {
  try {
    if (!sourcePath || !targetDir || !targetFileName) return null
    const normalizedSource = path.normalize(sourcePath)
    if (!fs.existsSync(normalizedSource)) return null
    if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true })

    const ext = path.extname(targetFileName) || path.extname(normalizedSource) || '.board'
    const base = path.basename(targetFileName, path.extname(targetFileName))
    let finalFileName = `${base}${ext}`
    let finalPath = join(targetDir, finalFileName)
    let counter = 1
    while (fs.existsSync(finalPath)) {
      finalFileName = `${base}_${counter}${ext}`
      finalPath = join(targetDir, finalFileName)
      counter++
    }

    fs.copyFileSync(normalizedSource, finalPath)
    return finalFileName
  } catch (err) {
    console.error('[main] boards:importBoardFile error:', err)
    return null
  }
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

// ===== OVERVIEW DESCRIPTION IPC HANDLERS =====
ipcMain.handle('overview:read', async (_, projectPath: string) => {
  try {
    const filePath = join(projectPath, 'overview', 'description.md')
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath, 'utf-8')
    }
    return ''
  } catch (error) {
    console.error('Failed to read overview description:', error)
    return ''
  }
})

ipcMain.handle('overview:save', async (_, projectPath: string, content: string) => {
  try {
    const overviewDir = join(projectPath, 'overview')
    if (!fs.existsSync(overviewDir)) {
      fs.mkdirSync(overviewDir, { recursive: true })
    }
    const filePath = join(overviewDir, 'description.md')
    await writeWithRetry(filePath, content)
    return true
  } catch (error) {
    console.error('Failed to save overview description:', error)
    return false
  }
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

ipcMain.handle('notes:save', async (_, dirPath: string, fileName: string, noteData: any) => {
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

    await writeWithRetry(filePath, fileContent)
    return true
  } catch (error) {
    console.error('Failed to save note:', error)
    return false
  }
})

// Backup IPC Handlers
ipcMain.handle('notes:createBackup', async (_, targetDir: string, noteData: any, originalFileName: string) => {
  try {
    const folderName = originalFileName.replace(/\.(md|board|ibo)$/, '')
    const backupBaseDir = join(targetDir, '.backups', folderName)
    
    if (!fs.existsSync(backupBaseDir)) {
      fs.mkdirSync(backupBaseDir, { recursive: true })
    }
    
    // YYYY-MM-DD_HH-mm-ss
    const now = new Date()
    const pad = (n) => n.toString().padStart(2, '0')
    const timestamp = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`
    
    const ext = noteData.type === 'board' ? 'board' : 'md'
    const fileName = `${timestamp}.${ext}`
    const backupFilePath = join(backupBaseDir, fileName)

    if (ext === 'md' && typeof noteData === 'object') {
       const { content, ...metadata } = noteData
       const fileContent = matter.stringify(content || '', metadata)
       fs.writeFileSync(backupFilePath, fileContent, 'utf-8')
    } else if (ext === 'board') {
       // For boards, copy the whole ZIP archive only if it's non-empty.
       const backupReason = noteData?.__backupReason
       const intervalMinutes = Math.max(1, Number(noteData?.__boardBackupIntervalMinutes) || 10)
       const intervalMs = intervalMinutes * 60 * 1000
       if (backupReason !== 'restore-preflight') {
         const recentBoardBackups = fs.readdirSync(backupBaseDir)
           .filter((f) => f.endsWith('.board') || f.endsWith('.ibo'))
           .map((f) => {
             const full = join(backupBaseDir, f)
             try {
               return fs.statSync(full).mtimeMs
             } catch {
               return 0
             }
           })
           .filter((ts) => ts > 0)
           .sort((a, b) => b - a)
         const latestBackupTs = recentBoardBackups[0] || 0
         if (latestBackupTs > 0 && Date.now() - latestBackupTs < intervalMs) {
           // Hard server-side throttle: skip board backup within configured interval.
           return true
         }
       }

       const sourceFileName = originalFileName.endsWith('.board') || originalFileName.endsWith('.ibo') ? originalFileName : `${originalFileName}.board`
       const candidates = [
        join(targetDir, sourceFileName),
        join(targetDir, 'boards', sourceFileName)
       ]
       const sourcePath = candidates.find((p) => fs.existsSync(p))
       if (!sourcePath) return false // Source board doesn't exist yet, can't backup
       const sourceStats = fs.statSync(sourcePath)
       if (sourceStats.size <= 0) return false // Never create backups from empty board files
       fs.copyFileSync(sourcePath, backupFilePath)
    } else {
       const fileContent = typeof noteData === 'string' ? noteData : JSON.stringify(noteData, null, 2)
       fs.writeFileSync(backupFilePath, fileContent, 'utf-8')
    }

    return true
  } catch(e) {
    console.error('Failed to create backup:', e)
    return false
  }
})

ipcMain.handle('notes:listBackups', async (_, targetDir: string, originalFileName: string) => {
  try {
    const folderName = originalFileName.replace(/\.(md|board|ibo)$/, '')
    const backupBaseDir = join(targetDir, '.backups', folderName)
    if (!fs.existsSync(backupBaseDir)) return []
    
    const files = fs.readdirSync(backupBaseDir).filter((f) => {
      if (!(f.endsWith('.md') || f.endsWith('.board') || f.endsWith('.ibo'))) return false
      const backupPath = join(backupBaseDir, f)
      try {
        return fs.statSync(backupPath).size > 0
      } catch {
        return false
      }
    })
    const backups = files.map(f => {
      const stats = fs.statSync(join(backupBaseDir, f))
      return {
        fileName: f,
        path: join(backupBaseDir, f),
        timestamp: stats.mtimeMs // Use actual modification time for sorting
      }
    })
    
    // Sort descending (newest first)
    return backups.sort((a, b) => b.timestamp - a.timestamp)
  } catch(e) {
    console.error('Failed to list backups:', e)
    return []
  }
})

ipcMain.handle('notes:readBackup', async (_, backupFilePath: string) => {
  try {
    if (fs.existsSync(backupFilePath)) {
      return fs.readFileSync(backupFilePath, 'utf-8')
    }
    return null
  } catch(e) {
    console.error('Failed to read backup:', e)
    return null
  }
})

ipcMain.handle('notes:restoreBackup', async (_, targetDir: string, originalFileName: string, backupFilePath: string) => {
  try {
    if (!fs.existsSync(backupFilePath)) {
      return { success: false, error: 'Backup file not found' }
    }
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true })
    }

    const targetPath = join(targetDir, originalFileName)
    const now = new Date()
    const pad = (n: number): string => n.toString().padStart(2, '0')
    const timestamp = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`

    // Safety snapshot of current file before restore
    if (fs.existsSync(targetPath)) {
      const folderName = originalFileName.replace(/\.(md|board|ibo)$/, '')
      const backupBaseDir = join(targetDir, '.backups', folderName)
      if (!fs.existsSync(backupBaseDir)) {
        fs.mkdirSync(backupBaseDir, { recursive: true })
      }
      const ext = path.extname(targetPath) || path.extname(backupFilePath) || '.md'
      const safetyPath = join(backupBaseDir, `${timestamp}_pre-restore${ext}`)
      fs.copyFileSync(targetPath, safetyPath)
    }

    const tmpRestorePath = `${targetPath}.restore_tmp`
    fs.copyFileSync(backupFilePath, tmpRestorePath)

    if (fs.existsSync(targetPath)) {
      const replacingPath = `${targetPath}.replacing`
      fs.renameSync(targetPath, replacingPath)
      fs.renameSync(tmpRestorePath, targetPath)
      setTimeout(() => { fs.promises.unlink(replacingPath).catch(() => {}) }, 100)
    } else {
      fs.renameSync(tmpRestorePath, targetPath)
    }

    return { success: true }
  } catch (e: any) {
    console.error('Failed to restore backup:', e)
    return { success: false, error: e?.message || String(e) }
  }
})

ipcMain.handle('notes:deleteBackup', async (_, backupFilePath: string) => {
  try {
    if (fs.existsSync(backupFilePath)) {
      fs.unlinkSync(backupFilePath)
    }
    return true
  } catch (e) {
    console.error('Failed to delete backup:', e)
    return false
  }
})

ipcMain.handle('notes:delete', async (_, dirPath: string, fileName: string) => {
  try {
    const filePath = join(dirPath, fileName)
    if (fs.existsSync(filePath)) {
      // Deletions usually don't strictly need retry for integrity, but they can be locked too.
      fs.unlinkSync(filePath)
    }
    return true
  } catch (error) {
    console.error('Failed to delete note:', error)
    return false
  }
})

ipcMain.handle('notes:rename', async (_, dirPath: string, oldFileName: string, newFileName: string) => {
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
          await renameWithRetry(oldPath, tempPath)
          await renameWithRetry(tempPath, newPath)
          return true
        } else {
          console.warn('[notes:rename] Target file already exists, skipping to avoid data loss:', newPath)
          return false
        }
      }
      await renameWithRetry(oldPath, newPath)
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

ipcMain.handle('projects:export', async (_, filePath: string, data: string) => {
  try {
    await writeWithRetry(filePath, data)
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

// ===== BOARD CACHE HELPERS =====
const getBoardCacheDir = (boardId: string): string => {
  return join(app.getPath('userData'), 'board-cache', boardId)
}

// ===== BOARD IPC HANDLERS =====

/**
 * boards:open-board
 * Unpacks a .board ZIP into the working cache and returns board.json as a string.
 * Asset URLs are converted from relative (assets/foo.png) → absolute file:/// in cache.
 */
ipcMain.handle('boards:open-board', async (_, dirPath: string, fileName: string, boardIdOverride?: string) => {
  const EMPTY_BOARD = JSON.stringify({ elements: [], viewport: { x: 0, y: 0, scale: 1 } })
  try {
    const containerPath = join(dirPath, fileName)
    let exists = await fs.promises.access(containerPath).then(() => true).catch(() => false)

    // Recovery path after crash/restart: restore from .replacing/.tmp/latest backup first.
    if (!exists || !hasZipSignature(containerPath)) {
      const recovered = recoverBoardContainerFromRecovery(dirPath, fileName)
      if (recovered) {
        exists = true
      }
    }

    if (!exists) return EMPTY_BOARD // Brand-new board, no file yet
    if (!hasZipSignature(containerPath)) {
      console.warn('boards:open-board: file is not a ZIP after recovery attempt, returning empty board:', containerPath)
      return EMPTY_BOARD
    }

    // Use note/board id from renderer when available; filename stem is not stable enough.
    const boardId = boardIdOverride || fileName.replace(/\.board$/, '').replace(/\.ibo$/, '')
    const cacheDir = getBoardCacheDir(boardId)
    const assetsDir = join(cacheDir, 'assets')

    // Always unpack fresh to keep cache in sync
    if (fs.existsSync(cacheDir)) {
      fs.rmSync(cacheDir, { recursive: true, force: true })
    }
    fs.mkdirSync(assetsDir, { recursive: true })

    let boardJsonStr = ''

    await new Promise<void>((resolve, reject) => {
      yauzl.open(containerPath, { lazyEntries: true }, (err, zipfile) => {
        if (err || !zipfile) { reject(err); return }

        zipfile.readEntry()
        const pending: Promise<void>[] = []

        zipfile.on('entry', (entry) => {
          if (entry.fileName === 'board.json') {
            pending.push(new Promise<void>((res, rej) => {
              zipfile.openReadStream(entry, (err, stream) => {
                if (err || !stream) { rej(err); return }
                const chunks: Buffer[] = []
                stream.on('data', c => chunks.push(c))
                stream.on('end', () => { boardJsonStr = Buffer.concat(chunks).toString('utf-8'); res() })
                stream.on('error', rej)
              })
            }))
            zipfile.readEntry()
          } else if (entry.fileName.startsWith('assets/') && !entry.fileName.endsWith('/')) {
            pending.push(new Promise<void>((res, rej) => {
              const destPath = join(cacheDir, entry.fileName)
              const destDir = path.dirname(destPath)
              if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true })
              zipfile.openReadStream(entry, (err, stream) => {
                if (err || !stream) { rej(err); return }
                const out = fs.createWriteStream(destPath)
                stream.pipe(out)
                out.on('close', res)
                out.on('error', rej)
              })
            }))
            zipfile.readEntry()
          } else {
            zipfile.readEntry()
          }
        })

        zipfile.on('end', async () => {
          try {
            await Promise.all(pending)
            zipfile.close()
            resolve()
          } catch(e) { reject(e) }
        })
        zipfile.on('error', reject)
      })
    })

    if (!boardJsonStr) return EMPTY_BOARD

    // Convert relative asset paths → absolute file:/// paths in cache
    const boardData = JSON.parse(boardJsonStr)
    const elements = boardData.elements || []
    for (const el of elements) {
      if (el.url && (el.url.startsWith('assets/') || el.url.startsWith('media/'))) {
        const assetFile = el.url.replace('assets/', '').replace('media/', '')
        const fullPath = join(cacheDir, 'assets', assetFile)
        el.url = `file:///${fullPath.replace(/\\/g, '/')}`
      }
    }

    return JSON.stringify(boardData)
  } catch (error) {
    console.error('boards:open-board error:', error)
    return JSON.stringify({ elements: [], viewport: { x: 0, y: 0, scale: 1 } })
  }
})

/**
 * boards:write-board-json
 * Persists the current board state (JSON string) into the cache folder only.
 * Fast — does NOT repack the ZIP.
 */
ipcMain.handle('boards:write-board-json', async (_, boardId: string, jsonStr: string) => {
  try {
    const cacheDir = getBoardCacheDir(boardId)
    if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true })

    // Safe JSON parsing
    let boardData
    const parseBoardPayload = (input: string): any => {
      let current: any = input
      for (let i = 0; i < 3; i++) {
        if (typeof current !== 'string') break
        current = JSON.parse(current)
      }
      return current
    }
    try {
      // If it's literally empty, don't just erase it, throw to prevent data loss if it shouldn't be empty
      if (!jsonStr || String(jsonStr).trim() === '') {
        throw new Error("Empty jsonStr payload received")
      }
      boardData = parseBoardPayload(String(jsonStr))
    } catch (parseError) {
      // Recovery path for malformed payloads with escaped brackets, e.g. "elements":\[\]
      try {
        const normalized = String(jsonStr)
          .replace(/\\\[/g, '[')
          .replace(/\\\]/g, ']')
          .replace(/\\\{/g, '{')
          .replace(/\\\}/g, '}')
        boardData = parseBoardPayload(normalized)
      } catch {
        console.error('[write-board-json] CRITICAL: Failed to parse JSON. Aborting write to prevent data loss. Length was:', jsonStr ? jsonStr.length : 0, parseError)
        return false // Return false to abort packing
      }
    }

    if (!boardData || typeof boardData !== 'object' || Array.isArray(boardData)) {
      console.error('[write-board-json] CRITICAL: Parsed payload is not a board object. Aborting write.')
      return false
    }

    if (!Array.isArray(boardData.elements)) boardData.elements = []
    if (!boardData.viewport || typeof boardData.viewport !== 'object') {
      boardData.viewport = { x: 0, y: 0, scale: 1 }
    }

    const elements = boardData.elements || []
    for (const el of elements) {
      if (el.url && el.url.startsWith('file:///') && el.url.includes('/board-cache/')) {
        const decoded = decodeURIComponent(el.url.replace('file:///', ''))
        const baseName = path.basename(decoded)
        el.url = `assets/${baseName}`
      }
    }

    await fs.promises.writeFile(join(cacheDir, 'board.json'), JSON.stringify(boardData, null, 2), 'utf-8')
    return true
  } catch (error) {
    console.error('boards:write-board-json error:', error)
    return false
  }
})

/**
 * boards:add-asset
 * Copies/decodes an asset into the cache's assets/ folder.
 * Returns the absolute file:/// URL in the cache.
 */
ipcMain.handle('boards:add-asset', async (_, boardId: string, assetId: string, assetData: string) => {
  try {
    const cacheDir = getBoardCacheDir(boardId)
    const assetsDir = join(cacheDir, 'assets')
    if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir, { recursive: true })

    let assetName = ''

    if (assetData.startsWith('data:')) {
      const commaIndex = assetData.indexOf(',')
      if (commaIndex !== -1) {
        const mimePart = assetData.substring(0, commaIndex)
        const base64Data = assetData.substring(commaIndex + 1)
        const buffer = Buffer.from(base64Data, 'base64')
        const mimeMatch = mimePart.match(/data:(.*?);/)
        const ext = mimeMatch ? mimeMatch[1].split('/')[1] : 'png'
        assetName = `${assetId}.${ext}`
        await fs.promises.writeFile(join(assetsDir, assetName), buffer)
      }
    } else if (assetData.startsWith('file:///')) {
      let sourcePath = assetData.replace('file:///', '')
      try { sourcePath = decodeURIComponent(sourcePath) } catch(e) {}
      const exists = await fs.promises.access(sourcePath).then(() => true).catch(() => false)
      if (exists) {
        const ext = path.extname(sourcePath) || '.png'
        assetName = `${assetId}${ext}`
        const destPath = join(assetsDir, assetName)
        if (sourcePath !== destPath) {
          await fs.promises.copyFile(sourcePath, destPath)
        }
      }
    }

    if (!assetName) return null

    const fullPath = join(assetsDir, assetName)
    return `file:///${fullPath.replace(/\\/g, '/')}`
  } catch (error) {
    console.error('boards:add-asset error:', error)
    return null
  }
})

/**
 * boards:pack-board
 * Packs the cache folder → .board ZIP atomically.
 * Writes to .board.tmp first, then renames to .board.
 */
ipcMain.handle('boards:pack-board', async (_, boardId: string, dirPath: string, fileName: string) => {
  try {
    const cacheDir = getBoardCacheDir(boardId)
    if (!fs.existsSync(cacheDir)) return false

    const containerPath = join(dirPath, fileName)
    const tmpPath = containerPath + '.tmp'

    // Ensure target dir exists
    if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true })

    const zipfile = new yazl.ZipFile()
    const writeStream = fs.createWriteStream(tmpPath)
    zipfile.outputStream.pipe(writeStream)

    // Read board.json from cache (already has relative paths from write-board-json)
    const boardJsonPath = join(cacheDir, 'board.json')
    if (!fs.existsSync(boardJsonPath)) {
      console.error('boards:pack-board: board.json is missing in cache, aborting pack to prevent data loss')
      return false
    }
    zipfile.addFile(boardJsonPath, 'board.json')

    // Add all assets
    const assetsDir = join(cacheDir, 'assets')
    if (fs.existsSync(assetsDir)) {
      const assetFiles = fs.readdirSync(assetsDir)
      for (const f of assetFiles) {
        zipfile.addFile(join(assetsDir, f), `assets/${f}`, { compress: false })
      }
    }

    await new Promise<void>((resolve, reject) => {
      zipfile.end()
      writeStream.on('close', resolve)
      writeStream.on('error', reject)
    })

    // Atomic rename: tmp → final
    if (fs.existsSync(containerPath)) {
      // Remove old without .old files — use temp + rename
      const backupPath = containerPath + '.replacing'
      await fs.promises.rename(containerPath, backupPath)
      await fs.promises.rename(tmpPath, containerPath)
      setTimeout(() => { fs.promises.unlink(backupPath).catch(() => {}) }, 100)
    } else {
      await fs.promises.rename(tmpPath, containerPath)
    }

    return true
  } catch (error) {
    console.error('boards:pack-board error:', error)
    return false
  }
})

/**
 * boards:list-versions
 */
ipcMain.handle('boards:list-versions', async (_, dirPath: string, fileName: string) => {
  try {
    const versionsDir = join(dirPath, fileName + '.versions')
    if (!fs.existsSync(versionsDir)) return []

    const files = fs.readdirSync(versionsDir)
    const versions = files
      .filter((f) => f.endsWith('.board') || f.endsWith('.ibo'))
      .map((f) => {
        const stats = fs.statSync(join(versionsDir, f))
        return {
          name: f,
          path: join(versionsDir, f),
          mtime: stats.mtimeMs,
          size: stats.size
        }
      })
      .sort((a, b) => b.mtime - a.mtime)

    return versions
  } catch (error) {
    console.error('boards:list-versions error:', error)
    return []
  }
})

/**
 * boards:create-version
 */
ipcMain.handle('boards:create-version', async (_, dirPath: string, fileName: string) => {
  try {
    const sourcePath = join(dirPath, fileName)
    if (!fs.existsSync(sourcePath)) return false

    const versionsDir = join(dirPath, fileName + '.versions')
    if (!fs.existsSync(versionsDir)) fs.mkdirSync(versionsDir, { recursive: true })

    // Find next version number
    const files = fs.readdirSync(versionsDir)
    let maxV = 0
    const vRegex = /v(\d+)\.board$/i
    files.forEach((f) => {
      const match = f.match(vRegex)
      if (match) {
        const v = parseInt(match[1])
        if (v > maxV) maxV = v
      }
    })

    const newVersionName = `v${maxV + 1}.board`
    const destPath = join(versionsDir, newVersionName)

    await fs.promises.copyFile(sourcePath, destPath)
    return true
  } catch (error) {
    console.error('boards:create-version error:', error)
    return false
  }
})

/**
 * boards:restore-version
 */
ipcMain.handle('boards:restore-version', async (_, dirPath: string, fileName: string, versionPath: string) => {
  try {
    const targetPath = join(dirPath, fileName)
    if (!fs.existsSync(versionPath)) return false

    // Optional: create a backup of current before restoring? User didn't ask but it's safer.
    // user said: "этот файл будут выбран как основной"

    await fs.promises.copyFile(versionPath, targetPath)
    return true
  } catch (error) {
    console.error('boards:restore-version error:', error)
    return false
  }
})

/**
 * boards:delete-version
 */
ipcMain.handle('boards:delete-version', async (_, versionPath: string) => {
  try {
    if (fs.existsSync(versionPath)) {
      await fs.promises.unlink(versionPath)
      return true
    }
    return false
  } catch (error) {
    console.error('boards:delete-version error:', error)
    return false
  }
})

/**
 * boards:close-board
 * Deletes the cache folder for a board (cleanup after closing).
 */
ipcMain.handle('boards:close-board', async (_, boardId: string) => {
  try {
    const cacheDir = getBoardCacheDir(boardId)
    if (fs.existsSync(cacheDir)) {
      fs.rmSync(cacheDir, { recursive: true, force: true })
    }
    return true
  } catch (error) {
    console.error('boards:close-board error:', error)
    return false
  }
})

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
  },
  {
    scheme: 'local-file',
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

  protocol.handle('local-file', async (req) => {
  try {
    const url = new URL(req.url)
    // url.pathname уже раскодирован браузером автоматически
    let filePath = url.pathname
    if (process.platform === 'win32' && filePath.startsWith('/')) {
      filePath = filePath.substring(1)
    }

    const absolutePath = path.resolve(filePath)
    const data = await fs.promises.readFile(absolutePath)

    const ext = path.extname(absolutePath).toLowerCase()
    let contentType = 'application/octet-stream'
    if (ext === '.png') contentType = 'image/png'
    else if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg'
    else if (ext === '.gif') contentType = 'image/gif'
    else if (ext === '.webp') contentType = 'image/webp'
    else if (ext === '.svg') contentType = 'image/svg+xml'
    else if (ext === '.bmp') contentType = 'image/bmp'

    return new Response(data, {
      headers: { 'Content-Type': contentType }
    })
  } catch (error) {
    console.error('local-file protocol error:', error)
    return new Response('Not found', { status: 404 })
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

// ===== GOOGLE CALENDAR AUTH =====
const GOOGLE_CLIENT_ID = '502882586830-q6ijqftc1pjr8erajlmsbm28b4oomj2n.apps.googleusercontent.com'
const GOOGLE_CLIENT_SECRET = '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'
const REDIRECT_URI = 'http://localhost:8081/oauth2callback'

// Create a temporary oauth2Client for the auth flow only
const authFlowClient = new google.auth.OAuth2(
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  REDIRECT_URI
)

ipcMain.handle('google:auth', async () => {
  return new Promise((resolve) => {
    const scopes = [
      'https://www.googleapis.com/auth/calendar.events',
      'https://www.googleapis.com/auth/calendar.readonly'
    ]
    
    const authUrl = authFlowClient.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent'
    })
    
    shell.openExternal(authUrl)
    
    const server = http.createServer(async (req, res) => {
      try {
        if (req.url?.startsWith('/oauth2callback')) {
          const qs = new URL(req.url, 'http://localhost:8081').searchParams
          const code = qs.get('code')
          
          if (code) {
             const { tokens } = await authFlowClient.getToken(code)
             
             // Save tokens to store
             if (safeStorage.isEncryptionAvailable()) {
               const encrypted = safeStorage.encryptString(JSON.stringify(tokens))
               store.set('google-auth-tokens', encrypted.toString('base64'))
             } else {
               store.set('google-auth-tokens', JSON.stringify(tokens))
             }
             
             // Immediately pass tokens to syncManager
             syncManager.setCredentials(tokens)
             
             res.end('Authentication successful! You can close this tab and return to Cluster.')
             server.close()
             resolve(true)
          } else {
             res.end('Failed to authenticate.')
             server.close()
             resolve(false)
          }
        }
      } catch (e) {
         res.end('Error parsing callback.')
         server.close()
         resolve(false)
      }
    }).listen(8081)
  })
})

ipcMain.handle('google:checkAuth', () => {
   // Delegate to syncManager which handles decryption robustly
   return syncManager.initializeAuth()
})

ipcMain.handle('google:disconnect', () => {
    store.delete('google-auth-tokens')
    return true
})

ipcMain.handle('google:sync:project', async (_, projectId: string, projectName: string, events: any[]) => {
   return await syncManager.syncProject(projectId, projectName, events)
})

// In this file you can include the rest of your app"s specific main process
// code. You can also put them in separate files and require them here.
