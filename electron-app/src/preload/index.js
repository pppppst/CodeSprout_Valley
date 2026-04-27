import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

const api = {
  // 开启悬浮窗
  enableFloatingMode: () => ipcRenderer.send('enable-floating-mode'),
  // 恢复主界面
  restoreMainUI: () => ipcRenderer.send('restore-main-ui')
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
