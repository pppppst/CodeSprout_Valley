export default class AppMainController {
  constructor() {
    this.currentLineCount = 0
    this.dailyTaskLimit = 200
    this.overflowExp = 0
    this.isFloatingMode = false
    this.mainWindow = null
    this.sessionTimer = null
  }

  addCodeLines(lines) {
    if (!Number.isFinite(lines) || lines <= 0) return

    const total = this.currentLineCount + lines
    if (total > this.dailyTaskLimit) {
      this.currentLineCount = this.dailyTaskLimit
      this.overflowExp += total - this.dailyTaskLimit
    } else {
      this.currentLineCount = total
    }
  }

  calculateOverflowExp() {
    return this.overflowExp
  }

  enableFloatingMode() {
    this.isFloatingMode = true
    this.mainWindow?.setAlwaysOnTop?.(true, 'screen-saver')
    this.sessionTimer?.start?.()
  }

  updateWindowPosition(x, y) {
    if (!this.isFloatingMode) return
    this.mainWindow?.setBounds?.({ x, y })
  }

  restoreMainWindow() {
    this.isFloatingMode = false
    this.mainWindow?.setAlwaysOnTop?.(false)
    this.sessionTimer?.pause?.()
  }
}
