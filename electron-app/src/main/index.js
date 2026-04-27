import { app, shell, BrowserWindow, ipcMain, Tray, Menu } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'

// 定义全局变量，确保在整个主进程中可以访问
let mainWindow
let floatingWindow
let tray

/**
 * 1. 创建常规主界面窗口
 * 保留标准 Windows 边框和标题栏
 */
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 810,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  // 拦截点击系统原生“最小化”按钮的事件
  mainWindow.on('minimize', (event) => {
    event.preventDefault() // 阻止默认的最小化到任务栏动作
    mainWindow.hide()      // 隐藏主窗口
    createFloatingWindow() // 召唤悬浮窗
    setupTray()            // 确保托盘图标存在
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // 加载渲染进程内容
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

/**
 * 2. 创建独立的桌面悬浮窗
 * 实现无边框、背景透明、始终置顶
 */
function createFloatingWindow() {
  if (floatingWindow) return // 避免重复创建

  floatingWindow = new BrowserWindow({
    width: 200,
    height: 200,
    transparent: true, // 允许透明背景
    frame: false,      // 移除窗口边框
    alwaysOnTop: true, // 始终置顶
    resizable: false,
    hasShadow: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  // 通过 Hash 路由 #floating 告诉前端只渲染宠物组件
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    floatingWindow.loadURL(`${process.env['ELECTRON_RENDERER_URL']}#floating`)
  } else {
    floatingWindow.loadFile(join(__dirname, '../renderer/index.html'), { hash: 'floating' })
  }

  floatingWindow.on('closed', () => {
    floatingWindow = null
  })
}

/**
 * 3. 封装统一的恢复主界面逻辑
 * 供托盘右键、托盘左键、悬浮窗双击共用
 */
function restoreMainInterface() {
  if (mainWindow) {
    mainWindow.show()
    mainWindow.focus() // 确保窗口获取焦点，直接显示在最前面
  }
  if (floatingWindow) {
    floatingWindow.close()
  }
  destroyTray()
}

/**
 * 4. 设置系统托盘
 * 提供恢复主界面的入口
 */
function setupTray() {
  if (tray) return

  tray = new Tray(icon)
  const contextMenu = Menu.buildFromTemplate([
    {
      label: '恢复主界面',
      click: () => restoreMainInterface()
    },
    { label: '退出 CodeSprout Valley', role: 'quit' }
  ])

  tray.setToolTip('CodeSprout Valley 陪伴中')
  tray.setContextMenu(contextMenu)

  // 监听托盘左键点击事件，实现一键直达恢复主界面
  tray.on('click', () => {
    restoreMainInterface()
  })
}

function destroyTray() {
  if (tray) {
    tray.destroy()
    tray = null
  }
}

// ============================================
// 当 Electron 完成初始化后的生命周期逻辑
// ============================================
app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.electron')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // 启动程序，显示主界面
  createWindow()

  // 监听来自 Vue 前端按钮的指令：手动开启悬浮模式
  ipcMain.on('enable-floating-mode', () => {
    if (mainWindow) mainWindow.hide()
    createFloatingWindow()
    setupTray()
  })

  // 监听来自悬浮窗的指令：手动恢复主界面
  ipcMain.on('restore-main-ui', () => {
    restoreMainInterface()
  })

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})