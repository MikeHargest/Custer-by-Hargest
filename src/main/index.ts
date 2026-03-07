import { app, shell, BrowserWindow, ipcMain, dialog, Notification, screen } from 'electron'
import { join } from 'path'
import fs from 'fs'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import StoreModule from 'electron-store'
import iconPng from '../../resources/icon.png?asset'
import iconIco from '../../resources/icon.ico?asset'

// Handle ESM / CJS interop for electron-store
const Store = typeof StoreModule === 'function' ? StoreModule : (StoreModule as any).default
const store = new Store()
const globalIconPath = join(__dirname, '../../resources/icon.png')

let mainWindow: BrowserWindow | null = null
const miniWindows: Record<string, BrowserWindow> = {}

function createWindow(): void {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 600,
    height: 700,
    show: false,
    frame: false,
    transparent: false,
    resizable: true,
    thickFrame: true,
    autoHideMenuBar: true,
    backgroundColor: '#1B1B1B',
    icon: process.platform === 'win32' ? iconIco : iconPng,
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

  const isQuiting = false

  // Hide instead of close to keep in tray
  mainWindow?.on('close', (e) => {
    if (!isQuiting) {
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
    const safeName = projectName.replace(/[<>:"/\\|?*]/g, '_')
    const projectDir = join(workspacePath, safeName)
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
    const parentDir = join(oldPath, '..')
    const safeName = newName.replace(/[<>:"/\\|?*]/g, '_')
    const newPath = join(parentDir, safeName)
    console.log('[renameProjectFolder] computing newPath:', newPath)

    if (oldPath !== newPath) {
      if (!fs.existsSync(newPath)) {
        console.log('[renameProjectFolder] calling fs.renameSync')
        fs.renameSync(oldPath, newPath)
        console.log('[renameProjectFolder] rename successful')
        return newPath
      } else {
        console.log('[renameProjectFolder] newPath already exists!')
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

ipcMain.handle('notes:save', (_, dirPath: string, fileName: string, content: string) => {
  try {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true })
    }
    const filePath = join(dirPath, fileName)
    fs.writeFileSync(filePath, content, 'utf-8')
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
      const type = ext === '.md' ? 'markdown' : 'tldraw'

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
ipcMain.handle('boards:list', (_, dirPath: string) => {
  try {
    if (!fs.existsSync(dirPath)) return []
    const files = fs.readdirSync(dirPath).filter((f: string) => f.endsWith('.board'))
    return files.map((f: string) => {
      const content = fs.readFileSync(join(dirPath, f), 'utf-8')
      const id = f.replace('.board', '')
      let title = 'Untitled Board'

      try {
        const parsed = JSON.parse(content)
        if (parsed && parsed.title) title = parsed.title
      } catch (e) {
        // ignore
      }

      return {
        id,
        title,
        content,
        type: 'board',
        lastModified: fs.statSync(join(dirPath, f)).mtimeMs
      }
    })
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

ipcMain.on('notification:show', (_, title, body) => {
  new Notification({ title, body, icon: globalIconPath }).show()
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

// State synchronization between Main Window and Mini Window
ipcMain.on('sync-timer-state', (_, timerId: string, state: any) => {
  if (miniWindows[timerId] && !miniWindows[timerId].isDestroyed()) {
    miniWindows[timerId].webContents.send('on-sync-timer-state', timerId, state)
  }
})

ipcMain.on('action-timer', (_, timerId: string, action: string) => {
  if (mainWindow) {
    mainWindow.webContents.send('on-action-timer', timerId, action)
  }
})

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  // Set app user model id for windows (needed for Notifications)
  electronApp.setAppUserModelId('com.multitimer')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  createWindow()

  // Create Tray Icon
  import('electron').then(({ Tray, Menu, nativeImage }) => {
    let trayIcon
    try {
      trayIcon = nativeImage.createFromPath(globalIconPath)
    } catch (e) {
      console.error(e)
    }

    const tray = new Tray(trayIcon || nativeImage.createEmpty())
    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Open',
        click: () => {
          const win = BrowserWindow.getAllWindows()[0]
          if (win) win.show()
        }
      },
      {
        label: 'Quit',
        click: () => {
          // @ts-ignore custom property assigned here for logic above
          app.isQuiting = true
          app.quit()
        }
      }
    ])
    tray.setToolTip('Time Builder')
    tray.setContextMenu(contextMenu)

    tray.on('click', () => {
      const win = BrowserWindow.getAllWindows()[0]
      if (win) win.show()
    })
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
