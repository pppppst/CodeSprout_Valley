import { ref } from 'vue'

/**
 * 悬浮窗相关逻辑组合函数
 * 将 App.vue 中的悬浮窗模式、拖拽窗口等功能抽取到此文件中。
 *
 * @param {object} deps - 来自 App.vue 的共享依赖
 * @param {Function} deps.setCatState
 * @param {Function} deps.restoreBaseCatState
 * @param {Function} deps.resetCatState
 * @param {Function} deps.stopBaseAnimation
 * @param {Function} deps.startBaseAnimation
 * @param {Function} deps.clearActionInterval
 * @param {Function} deps.clearCatStateTimer
 */
export function useFloatingWindow(deps) {
  const {
    setCatState,
    restoreBaseCatState,
    resetCatState,
    stopBaseAnimation,
    startBaseAnimation,
    clearActionInterval,
    clearCatStateTimer,
  } = deps

  // ============ 状态 ============
  const isFloatingMode = ref(false)

  // 拖拽窗口相关变量
  let isWindowDragging = false
  let dragStartScreenX = 0
  let dragStartScreenY = 0
  let currentWindowX = 0
  let currentWindowY = 0
  let lastMoveTime = 0
  const MOVE_INTERVAL = 16 // ≈ 60fps

  // ============ hash 路由 ============
  function checkHash() {
    isFloatingMode.value = window.location.hash === '#floating'
    if (isFloatingMode.value) {
      document.documentElement.classList.add('floating')
      document.body.classList.add('floating')
    } else {
      document.documentElement.classList.remove('floating')
      document.body.classList.remove('floating')
    }
  }

  function onHashChange() {
    checkHash()
  }

  // ============ 窗口恢复 ============
  function handleRestore() {
    if (window.api && typeof window.api.restoreMainUI === 'function') {
      window.api.restoreMainUI()
    }
  }

  // ============ 拖拽动作 ============
  function handleDragStart() {
    if (!isFloatingMode.value) return
    clearCatStateTimer()
    setCatState('lifted')
  }

  function handleDragEnd() {
    restoreBaseCatState()
    resetCatState(2000)
  }

  async function onCatMouseDown(e) {
    stopBaseAnimation()
    clearActionInterval()
    if (!isFloatingMode.value) return
    if (e.button !== 0) return
    e.preventDefault()

    // 鼠标穿透：拖拽时整个窗口捕获事件，确保流畅
    window.electron?.ipcRenderer?.send('floating:disable-ignore-mouse')

    handleDragStart()

    try {
      const pos = await window.electron?.ipcRenderer?.invoke('get-window-position')
      if (pos) {
        currentWindowX = pos.x
        currentWindowY = pos.y
      }
    } catch (err) {
      console.warn('获取窗口位置失败', err)
      currentWindowX = 0
      currentWindowY = 0
    }

    isWindowDragging = true
    dragStartScreenX = e.screenX
    dragStartScreenY = e.screenY
  }

  function onCatMouseMove(e) {
    if (!isWindowDragging) return
    const now = Date.now()
    if (now - lastMoveTime < MOVE_INTERVAL) return
    lastMoveTime = now

    const deltaX = e.screenX - dragStartScreenX
    const deltaY = e.screenY - dragStartScreenY
    const newX = currentWindowX + deltaX
    const newY = currentWindowY + deltaY
    window.electron?.ipcRenderer?.send('move-floating-window', { x: newX, y: newY })
  }

  function onCatMouseUp() {
    if (!isWindowDragging) return
    isWindowDragging = false

    // 恢复鼠标穿透：非拖拽时透明区域穿透到下层窗口
    window.electron?.ipcRenderer?.send('floating:enable-ignore-mouse')

    handleDragEnd()
    startBaseAnimation()
  }

  // ============ 生命周期辅助 ============
  function setupFloatingListeners() {
    window.addEventListener('hashchange', onHashChange)
    window.addEventListener('mousemove', onCatMouseMove)
    window.addEventListener('mouseup', onCatMouseUp)
  }

  function teardownFloatingListeners() {
    window.removeEventListener('hashchange', onHashChange)
    window.removeEventListener('mousemove', onCatMouseMove)
    window.removeEventListener('mouseup', onCatMouseUp)
  }

  return {
    isFloatingMode,
    checkHash,
    onHashChange,
    handleRestore,
    handleDragStart,
    handleDragEnd,
    onCatMouseDown,
    onCatMouseMove,
    onCatMouseUp,
    setupFloatingListeners,
    teardownFloatingListeners
  }
}
