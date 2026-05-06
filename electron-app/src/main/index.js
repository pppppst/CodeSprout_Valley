import { app, shell, BrowserWindow, Menu, Tray, ipcMain } from 'electron'
import { join } from 'path'
import http from 'node:http'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'

// === 来自 new_ui_4_27 的设计尺寸 ===
const DESIGN_WIDTH = 1365
const DESIGN_HEIGHT = 768

// === 来自 main 的全局变量，确保整个主进程可访问 ===
let mainWindow
let floatingWindow
let tray = null
let pluginBridgeServer = null
let latestPluginActivity = {
  codeAdded: 0,
  errorCount: 0,
  codePassed: 0,
  codingDuration: 0,
  timestamp: 0
}

function broadcastPluginActivity(payload) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('activity:update', payload)
  }
  if (floatingWindow && !floatingWindow.isDestroyed()) {
    floatingWindow.webContents.send('activity:update', payload)
  }
}

function startPluginBridgeServer() {
  if (pluginBridgeServer) return

  pluginBridgeServer = http.createServer((req, res) => {
    if (req.method !== 'POST' || req.url !== '/activity-report') {
      res.writeHead(404, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ ok: false, error: 'not found' }))
      return
    }

    let body = ''
    req.on('data', (chunk) => {
      body += chunk
      if (body.length > 1_000_000) {
        req.destroy()
      }
    })

    req.on('end', () => {
      try {
        const incoming = JSON.parse(body || '{}')

        // 数值字段做累加（以便主进程维持一个当天累积快照），非数值字段直接覆盖
        const numericKeys = ['codeAdded', 'errorCount', 'codePassed', 'codingDuration']
        numericKeys.forEach((k) => {
          if (typeof incoming[k] === 'number' && Number.isFinite(incoming[k])) {
            latestPluginActivity[k] = (latestPluginActivity[k] || 0) + incoming[k]
          }
        })

        // 合并其他字段（如果需要）并更新时间戳
        latestPluginActivity = {
          ...latestPluginActivity,
          ...incoming,
          timestamp: Date.now()
        }

        broadcastPluginActivity(latestPluginActivity)

        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ ok: true }))
      } catch {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ ok: false, error: 'invalid json' }))
      }
    })
  })

  pluginBridgeServer.on('error', (error) => {
    console.error('[CS Valley] Plugin bridge server error:', error)
  })

  pluginBridgeServer.listen(3001, '127.0.0.1', () => {
    console.log('[CS Valley] Plugin bridge server listening at http://127.0.0.1:3001/activity-report')
  })
}

/**
 * 1. 创建常规主界面窗口
 */
function createWindow() {
  mainWindow = new BrowserWindow({
    width: DESIGN_WIDTH, // 使用新 UI 尺寸
    height: DESIGN_HEIGHT,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  // Lock resizing to the original UI ratio (来自 new_ui_4_27)
  mainWindow.setAspectRatio(DESIGN_WIDTH / DESIGN_HEIGHT)

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  // 拦截点击系统原生“最小化”按钮的事件 (来自 main 悬浮窗逻辑)
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
 * 2. 创建独立的桌面悬浮窗 (来自 main)
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
 * 3. 封装统一的恢复主界面逻辑 (来自 main)
 * 供托盘右键、托盘左键、悬浮窗双击共用
 */
function restoreMainInterface() {
  if (mainWindow) {
    mainWindow.show()
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus() // 确保窗口获取焦点，直接显示在最前面
  }
  if (floatingWindow) {
    floatingWindow.close()
  }
  destroyTray()
}

/**
 * 4. 设置系统托盘 (来自 main)
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
    { type: 'separator' },
    { label: '退出 CodeSprout Valley', click: () => app.quit() }
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

  // === 合并的 IPC 通信逻辑 ===

  // 1. 来自 new_ui_4_27 的自定义窗口控制 (适配了全局变量)
  ipcMain.on('ping', () => console.log('pong'))
  ipcMain.on('window:minimize', () => {
    if (mainWindow) mainWindow.minimize() // 触发原生的 minimize 事件，进而打开悬浮窗
  })
  ipcMain.on('window:hideToTray', () => {
    if (mainWindow) mainWindow.hide()
    setupTray()
  })
  ipcMain.on('window:close', () => app.quit())

  // 启动程序，显示主界面
  createWindow()
  startPluginBridgeServer()

  // 2. 来自 main 的悬浮窗与托盘控制
  ipcMain.on('enable-floating-mode', () => {
    if (mainWindow) mainWindow.hide()
    createFloatingWindow()
    setupTray()
  })

  ipcMain.on('restore-main-ui', () => {
    restoreMainInterface()
  })

  ipcMain.handle('activity:get-latest', () => {
    return latestPluginActivity
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

app.on('before-quit', () => {
  if (pluginBridgeServer) {
    pluginBridgeServer.close()
    pluginBridgeServer = null
  }

  if (tray) {
    tray.destroy()
    tray = null
  }
})