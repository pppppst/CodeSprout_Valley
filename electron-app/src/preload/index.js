import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// 整合两套自定义 APIs 供渲染进程使用
const api = {
  // === 来自 new_ui_4_27：自定义标题栏的窗口控制 ===
  minimizeWindow: () => ipcRenderer.send('window:minimize'),
  hideToTray: () => ipcRenderer.send('window:hideToTray'),
  closeWindow: () => ipcRenderer.send('window:close'),

  // === 来自 main：桌面宠物悬浮窗控制 ===
  enableFloatingMode: () => ipcRenderer.send('enable-floating-mode'),
  restoreMainUI: () => ipcRenderer.send('restore-main-ui'),

  // === 插件数据桥接：主进程 -> 渲染进程 ===
  onActivityUpdate: (handler) => {
    const listener = (_event, payload) => {
      if (typeof handler === 'function') {
        handler(payload)
      }
    }
    ipcRenderer.on('activity:update', listener)
    return () => ipcRenderer.removeListener('activity:update', listener)
  },
  getLatestActivity: () => ipcRenderer.invoke('activity:get-latest')
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  window.electron = electronAPI
  window.api = api
}