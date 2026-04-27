import { app, shell, BrowserWindow, Menu, Tray, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'

const DESIGN_WIDTH = 1365
const DESIGN_HEIGHT = 768
let tray = null

function getMainWindow() {
  return BrowserWindow.getAllWindows()[0] ?? null
}

function showMainWindow() {
  const mainWindow = getMainWindow()
  if (!mainWindow) return
  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.show()
  mainWindow.focus()
}

function createTray() {
  if (tray) return

  tray = new Tray(icon)
  tray.setToolTip('CodeSprout Valley')
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: '显示主界面', click: () => showMainWindow() },
      { type: 'separator' },
      { label: '退出', click: () => app.quit() }
    ])
  )
  tray.on('double-click', () => showMainWindow())
}

// 【关键修改 1】：把创建窗口的所有代码，包裹在 createWindow 函数里！
function createWindow() {
  const mainWindow = new BrowserWindow({
    width: DESIGN_WIDTH,
    height: DESIGN_HEIGHT,
    show: false,
    autoHideMenuBar: true,
    transparent: false, // 不允许背景透明
    frame: false,      // 隐藏自带的标题栏（白框）
    hasShadow: false,  // 去除阴影
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  // Lock resizing to the original UI ratio.
  mainWindow.setAspectRatio(DESIGN_WIDTH / DESIGN_HEIGHT)

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  createTray()
}

// 【关键修改 2】：等待 app 的 ready 事件触发
app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.electron')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  ipcMain.on('ping', () => console.log('pong'))
  ipcMain.on('window:minimize', () => {
    const mainWindow = getMainWindow()
    if (mainWindow) mainWindow.minimize()
  })
  ipcMain.on('window:hideToTray', () => {
    const mainWindow = getMainWindow()
    if (mainWindow) mainWindow.hide()
  })
  ipcMain.on('window:close', () => app.quit())

  // 只有在这里（底层引擎就绪后），才能安全地调用函数创建窗口
  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  if (tray) {
    tray.destroy()
    tray = null
  }
})