<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { getActiveJieQi } from './utils/calendar'
// 🌟 1. 引入所有新的云端接口
import { registerAccount, loginAccount, fetchCloudSave, updateUserProfile, syncCloudSave, uploadTermDailyStat, fetchTermStats, saveTermReport, fetchHistoryReports } from './utils/cloudApi'
import WeatherEffect from './components/WeatherEffect.vue'
import { useFloatingWindow } from './components/floatingWindow'
import { SolarUtil } from 'lunar-javascript'
import { bubbleMessages } from './bubbleMessages'

const authUsername = ref('')
const authPassword = ref('')
const authStatusMessage = ref('等待登录后同步云端存档')
const cloudToken = ref(localStorage.getItem('codeSproutToken') || '')
const loggedInUser = ref(localStorage.getItem('codeSproutUser') || '')
const isCloudBusy = ref(false)
const isRestoringSession = ref(Boolean(cloudToken.value && loggedInUser.value))
const lastSyncTime = ref(localStorage.getItem('codeSproutLastSyncTime') || '')
const isArchiveOpen = ref(false)
const hasNewHarvest = ref(false)
const hasNewReport = ref(false)
const selectedArchiveTermKey = ref('')
const latestHarvestTermKey = ref('')
const latestReportTermKey = ref('')
const previewImage = ref(null)
const isAuthenticated = computed(() => Boolean(cloudToken.value && loggedInUser.value && !isRestoringSession.value))
const isAuthGateVisible = computed(() => !isAuthenticated.value)

const PENDING_SYNC_STORAGE_PREFIX = 'codeSproutPendingSync'
const LAST_SEEN_SOLAR_TERM_KEY = 'codeSproutLastSeenSolarTerm'
const SETTLED_SOLAR_TERMS_KEY = 'codeSproutSettledSolarTerms2026'
const SOLAR_TERM_REPORT_YEAR = 2026
const AUTO_SYNC_INTERVAL_MS = 30000

function normalizePendingSync(value) {
  const codeLines = Math.max(0, Number(value?.codeLines || 0))
  return {
    codeLines,
    commitCount: Math.max(0, Number(value?.commitCount || 0)),
    errorCount: Math.max(0, Number(value?.errorCount || 0)),
    archiveCodeLines: Math.max(0, Number(value?.archiveCodeLines ?? codeLines))
  }
}

function getPendingSyncStorageKey(username = loggedInUser.value) {
  return `${PENDING_SYNC_STORAGE_PREFIX}:${username || 'anonymous'}`
}

function loadPendingSyncFromStorage(username = loggedInUser.value) {
  try {
    const saved = localStorage.getItem(getPendingSyncStorageKey(username))
    return normalizePendingSync(saved ? JSON.parse(saved) : {})
  } catch {
    return normalizePendingSync({})
  }
}

function savePendingSyncToStorage() {
  const normalized = normalizePendingSync(pendingSync.value)
  if (normalized.codeLines === 0 && normalized.commitCount === 0 && normalized.errorCount === 0 && normalized.archiveCodeLines === 0) {
    clearPendingSyncStorage()
    return
  }
  localStorage.setItem(getPendingSyncStorageKey(), JSON.stringify(normalized))
}

function clearPendingSyncStorage(username = loggedInUser.value) {
  localStorage.removeItem(getPendingSyncStorageKey(username))
}

function loadSettledSolarTerms() {
  try {
    const saved = localStorage.getItem(SETTLED_SOLAR_TERMS_KEY)
    const parsed = saved ? JSON.parse(saved) : []
    return Array.isArray(parsed) ? parsed.filter((name) => typeof name === 'string' && name.trim()) : []
  } catch {
    return []
  }
}

function saveSettledSolarTerms() {
  localStorage.setItem(SETTLED_SOLAR_TERMS_KEY, JSON.stringify(settledSolarTerms.value))
}

// ==========================================
// 🌟 新增：自动同步缓冲池 (存钱罐)
// ==========================================
const pendingSync = ref(loadPendingSyncFromStorage())
const lastSeenSolarTerm = ref(localStorage.getItem(LAST_SEEN_SOLAR_TERM_KEY) || '')
const settledSolarTerms = ref(loadSettledSolarTerms())
let autoSyncTimer = null
let autoSyncInFlight = false
let hasAutoSyncFailure = false

watch(pendingSync, savePendingSyncToStorage, { deep: true })
watch(settledSolarTerms, saveSettledSolarTerms, { deep: true })

function setAuthSession(token, username) {
  cloudToken.value = token
  loggedInUser.value = username
  localStorage.setItem('codeSproutToken', token)
  localStorage.setItem('codeSproutUser', username)
}

function clearUserProfile() {
  userNickname.value = ''
  userBirthday.value = ''
  localStorage.removeItem('codeSproutNickname')
  localStorage.removeItem('codeSproutBirthday')
}

function clearAuthSession() {
  cloudToken.value = ''
  loggedInUser.value = ''
  isRestoringSession.value = false
  lastSyncTime.value = ''
  localStorage.removeItem('codeSproutToken')
  localStorage.removeItem('codeSproutUser')
  localStorage.removeItem('codeSproutLastSyncTime')
  clearUserProfile()
}

function applyCloudSave(save) {
  if (!save) return

  if (typeof save.nickname === 'string') userNickname.value = save.nickname
  if (typeof save.birthday === 'string') userBirthday.value = save.birthday

  const totalCodeLines = Number(save.totalCodeLines || 0)
  codeLines.value = totalCodeLines
  syncedCodeLines.value = totalCodeLines
  foodStock.value = Number(save.catFood || 0)
  waterStock.value = Number(save.waterDrops || 0)

  if (save.lastSyncTime) {
    lastSyncTime.value = new Date(save.lastSyncTime).toLocaleString()
    localStorage.setItem('codeSproutLastSyncTime', lastSyncTime.value)
  }
}

async function loadCloudSave() {
  if (!cloudToken.value) return

  const result = await fetchCloudSave(cloudToken.value)
  applyCloudSave(result.data)
}

async function fetchLatestActivitySnapshot() {
  if (!isAuthenticated.value || !window.api?.getLatestActivity) return

  try {
    const data = await window.api.getLatestActivity()
    applyActivityUpdate(data)
  } catch (err) {
    console.error('[CS Valley]', err)
  }
}

async function handleRegister() {
  if (!authUsername.value.trim() || !authPassword.value) {
    authStatusMessage.value = '用户名和密码不能为空'
    return
  }

  isCloudBusy.value = true
  authStatusMessage.value = '正在注册账号...'
  try {
    await registerAccount(authUsername.value.trim(), authPassword.value)
    authStatusMessage.value = '注册成功，请点击登录'
  } catch (error) {
    authStatusMessage.value = `注册失败：${error.message}`
  } finally {
    isCloudBusy.value = false
  }
}

async function handleLogin() {
  if (!authUsername.value.trim() || !authPassword.value) {
    authStatusMessage.value = '用户名和密码不能为空'
    return
  }

  isCloudBusy.value = true
  authStatusMessage.value = '正在登录并拉取云端存档...'
  try {
    const result = await loginAccount(authUsername.value.trim(), authPassword.value)
    setAuthSession(result.token, result.username)
    pendingSync.value = loadPendingSyncFromStorage(result.username)
    applyCloudSave(result.data)
    await loadCloudSave()
    isRestoringSession.value = false
    authStatusMessage.value = '登录成功，云端存档已加载'
  } catch (error) {
    clearAuthSession()
    authStatusMessage.value = `登录失败：${error.message}`
  } finally {
    isCloudBusy.value = false
  }
}

async function handleCloudSync() {
  if (!cloudToken.value) {
    authStatusMessage.value = '请先登录账号再同步'
    return
  }

  const linesToSync = Math.max(0, codeLines.value - syncedCodeLines.value)
  const payload = {
    addedLines: linesToSync,
    catFood: foodStock.value,
    waterDrops: waterStock.value,
    plantStage: currentPlantStage.value
  }

  isCloudBusy.value = true
  authStatusMessage.value = '正在同步云端存档...'
  try {
    const result = await syncCloudSave(cloudToken.value, payload)
    applyCloudSave(result.data)
    authStatusMessage.value = `同步完成，本次新增 ${linesToSync} 行代码`
  } catch (error) {
    if (error.status === 401) {
      clearAuthSession()
    }
    authStatusMessage.value = `同步失败：${error.message}`
  } finally {
    isCloudBusy.value = false
  }
}

// ==========================================
// 🌟 新增：后台自动静默同步逻辑 (Bug已修复版)
// ==========================================
async function processAutoSync() {
  // 未登录时不自动上传云端，但本地数据仍正常累计
  if (!isAuthenticated.value) return
  if (autoSyncInFlight) return

  const hasPendingStats = pendingSync.value.codeLines > 0 || pendingSync.value.commitCount > 0 || pendingSync.value.errorCount > 0
  const archiveCodeLines = Math.max(0, Number(pendingSync.value.archiveCodeLines || 0))
  
  autoSyncInFlight = true
  try {
    // 1. 🌟 修复：无条件同步总资产！这样你的喂猫、浇水等物资变化都会每 30 秒上云，并且刷新界面的同步时间。
    const archivePayload = {
      addedLines: archiveCodeLines,
      catFood: foodStock.value,
      waterDrops: waterStock.value,
      plantStage: currentPlantStage.value
    }
    const syncResult = await syncCloudSave(cloudToken.value, archivePayload)
    applyCloudSave(syncResult.data) // 这行会让界面的“最近同步时间”刷新！
    pendingSync.value.archiveCodeLines = 0

    // 2. 再上传当天的节气增量统计数据（只有有数据时才上传这部分）
    if (hasPendingStats) {
      const statsPayload = {
        date: getTodayString(),
        solarTerm: currentSolarTerm.value || '未知',
        codeLines: pendingSync.value.codeLines,
        commitCount: pendingSync.value.commitCount,
        errorCount: pendingSync.value.errorCount
      }
      
      await uploadTermDailyStat(cloudToken.value, statsPayload)

      // 🌟 核心防丢机制：只有云端返回成功，才清空本地缓冲池
      pendingSync.value.codeLines = 0
      pendingSync.value.commitCount = 0
      pendingSync.value.errorCount = 0
      pendingSync.value.archiveCodeLines = 0
      clearPendingSyncStorage()
    }
    if (hasAutoSyncFailure) {
      authStatusMessage.value = '自动同步已恢复，暂存数据已补传'
    }
    hasAutoSyncFailure = false
  } catch (error) {
    console.warn('[CS Valley] 自动同步失败，数据已暂存本地，等待下一次重试:', error)
    hasAutoSyncFailure = true
    authStatusMessage.value = '自动同步暂时失败，数据已保存在本地，将继续重试。'
    if (error.status === 401) {
      clearAuthSession() // 如果 Token 过期，自动退出登录
    }
  } finally {
    autoSyncInFlight = false
  }
}

function handleLogout() {
  clearPendingSyncStorage()
  clearAuthSession()
  authUsername.value = ''
  authPassword.value = ''
  codeLines.value = 0
  syncedCodeLines.value = 0
  foodStock.value = 0
  waterStock.value = 0

  // 🌟 修复状态泄漏：彻底清空图鉴、报告和植物状态，确保下一个用户面对的是纯净环境
  harvestRecords.value = {}
  reportRecords.value = {}
  plantWaterByTerm.value = {}
  hasNewHarvest.value = false
  hasNewReport.value = false
  selectedArchiveTermKey.value = ''
  latestHarvestTermKey.value = ''
  latestReportTermKey.value = ''
  pendingSync.value = { codeLines: 0, commitCount: 0, errorCount: 0, archiveCodeLines: 0 }
  isSettingsPanelOpen.value = false
  isCloudAccountPanelOpen.value = false
  isUserProfilePanelOpen.value = false
  isArchiveOpen.value = false

  authStatusMessage.value = '已退出登录，本地账号状态已彻底清空'
}


const bubbleTop = computed(() => {
  return isFloatingMode.value ? '60%' : '69%'
})


const uiScale = ref(1)
function updateUiScale() {
  const designWidth = 1365
  const designHeight = 768
  const scaleX = window.innerWidth / designWidth
  const scaleY = window.innerHeight / designHeight
  uiScale.value = Math.min(scaleX, scaleY)
}

// ==========================================
// 2. 核心业务与资源状态
// ==========================================
const codeLines = ref(150)
const syncedCodeLines = ref(0)
const catExp = ref(0)
const message = ref('🐱 睡觉中...')
const isBubbleShaking = ref(false)
let lastBubbleIndex = -1
function shakeBubble() {
  if (isBubbleShaking.value) return
  let idx
  do {
    idx = Math.floor(Math.random() * bubbleMessages.length)
  } while (idx === lastBubbleIndex && bubbleMessages.length > 1)
  lastBubbleIndex = idx
  message.value = bubbleMessages[idx]
  isBubbleShaking.value = true
  setTimeout(() => { isBubbleShaking.value = false }, 400)
}

const feedCount = ref(0)
const waterCount = ref(0)
const foodStock = ref(20)
const waterStock = ref(20)

const todayPassed = ref(0)
const todayErrors = ref(0)
let offActivityUpdate = null
const isStatsVisible = ref(true)
const isSettingsPanelOpen = ref(false)
const isCloudAccountPanelOpen = ref(false)
const isUserProfilePanelOpen = ref(false)
const userNickname = ref('')
const userBirthday = ref('')


const CODE_LINES_PER_REWARD = 50
const RESOURCE_PER_REWARD = 20
const WATER_COST = 20
const MAX_WATERINGS_PER_TERM = 120
const MAX_WATER_REWARDED_LINES = MAX_WATERINGS_PER_TERM * CODE_LINES_PER_REWARD

const plantWaterByTerm = ref({})
const suppressResourceRewards = ref(false)

// ==========================================
// 3. 宠物交互控制 (引入序列帧与周期性动画)
// ==========================================
const catState = ref('sleep')

function createSequentialFrames(folderName, filePrefix, frameCount, padLength) {
  return Array.from({ length: frameCount }, (_, index) => {
    const suffix = String(index + 1).padStart(padLength, '0')
    return new URL(`./assets/Cat/${folderName}/${filePrefix}_${suffix}.png`, import.meta.url).href
  })
}

// --- 帧动画资产引入 ---
const sleepFrames = createSequentialFrames('cat_sleep', 'cat_sleep', 4, 1)
const playFrames = createSequentialFrames('cat_play', 'play', 10, 2)
const stretchFrames = createSequentialFrames('cat_stretch', 'stretch', 10, 2)
const jumpFrames = createSequentialFrames('cat_jump', 'cat_jump', 8, 1)
const walkFrames = createSequentialFrames('cat_walk', 'walk', 10, 2)

const catImages = {
  eating: new URL('./assets/Cat/cat_eat.png', import.meta.url).href,
  happy: new URL('./assets/Cat/cat_happy.png', import.meta.url).href,
  refused: new URL('./assets/Cat/cat_sad.png', import.meta.url).href,
  lifted: new URL('./assets/Cat/cat_lifted.png', import.meta.url).href 
}

// 动画播放下标
const currentSleepFrame = ref(0)
const currentPlayFrame = ref(0)
const currentStretchFrame = ref(0)
const currentJumpFrame = ref(0)
const currentWalkFrame = ref(0)

const CAT_MESSAGES = {
  sleep: '🐱 睡觉中...',
  play: '😺 充满活力，玩耍中！',
  eating: '😺 吧唧吧唧...猫粮真香！(经验+10)',
  happy: '❤️ 呼噜呼噜...最喜欢你了！',
  refused: '😿 喵...肚子饿，可是猫粮不足 10 份！',
  lifted: '哇！起飞啦~',
  landed: '稳稳落地！继续玩耍~',
  watering: '🌱 咕噜咕噜...水好甜！'
}

const BASE_CAT_STATES = new Set(['sleep', 'play'])

const actionStates = new Set(['eating', 'happy', 'refused', 'stretching', 'jumping', 'lifted'])

function getBaseCatState() {
  return lastFedDate.value === getTodayString() ? 'play' : 'sleep'
}

function clearCatStateTimer() {
  if (!catStateTimer) return
  clearTimeout(catStateTimer)
  catStateTimer = null
}

function clearActionInterval() {
  if (!actionInterval) return
  clearInterval(actionInterval)
  actionInterval = null
}
// ==========================================
// 1. 悬浮窗与基础环境配置
// ==========================================
const {
  isFloatingMode,
  checkHash,
  handleRestore,
  onCatMouseDown,
  onCatMouseMove,
  onCatMouseUp,
  setupFloatingListeners,
  teardownFloatingListeners
} = useFloatingWindow({
  setCatState,
  restoreBaseCatState,
  resetCatState,
  stopBaseAnimation,
  startBaseAnimation,
  clearActionInterval,
  clearCatStateTimer,
  message,
  CAT_MESSAGES
})



function setCatState(nextState, nextMessage) {
  catState.value = nextState
  if (typeof nextMessage === 'string') {
    message.value = nextMessage
  }
}

function restoreBaseCatState() {
  const baseState = getBaseCatState()
  setCatState(baseState, CAT_MESSAGES[baseState])
  return baseState
}

function syncCatStateToBase() {
  if (!actionStates.has(catState.value)) {
    restoreBaseCatState()
  }
}

// 动态计算当前的猫咪图片
const currentCatImage = computed(() => {
  if (catState.value === 'lifted') return catImages.lifted || sleepFrames[0]
  if (isFloatingMode.value) return walkFrames[currentWalkFrame.value]
  if (catState.value === 'sleep') return sleepFrames[currentSleepFrame.value]
  if (catState.value === 'play') return playFrames[currentPlayFrame.value]
  if (catState.value === 'stretching') return stretchFrames[currentStretchFrame.value]
  if (catState.value === 'jumping') return jumpFrames[currentJumpFrame.value]
  return catImages[catState.value] || sleepFrames[0]
})

// --- 定时器逻辑控制 ---
let baseAnimationInterval = null
let catStateTimer = null
let periodicTimer = null
let actionInterval = null 

function startBaseAnimation() {
  if (baseAnimationInterval) return
  baseAnimationInterval = setInterval(() => {
    if (isFloatingMode.value) {
      if (catState.value !== 'lifted') {
        currentWalkFrame.value = (currentWalkFrame.value + 1) % walkFrames.length
      }
      return
    }

    if (catState.value === 'sleep') {
      currentSleepFrame.value = (currentSleepFrame.value + 1) % sleepFrames.length
    } else if (catState.value === 'play') {
      currentPlayFrame.value = (currentPlayFrame.value + 1) % playFrames.length
    }
  }, catState.value === 'play' ? 250 : 500)
}

function stopBaseAnimation() {
  if (baseAnimationInterval) {
    clearInterval(baseAnimationInterval)
    baseAnimationInterval = null
  }
}

watch(catState, (newState, oldState) => {
  if (newState === oldState || !BASE_CAT_STATES.has(newState)) return

  stopBaseAnimation()
  startBaseAnimation()
})

// 触发伸懒腰动画
function triggerStretch() {
  setCatState('stretching')
  currentStretchFrame.value = 0
  let frame = 0
  clearActionInterval()
  actionInterval = setInterval(() => {
    frame++
    if (frame >= stretchFrames.length) {
      clearActionInterval()
      restoreBaseCatState() // 伸完懒腰回到当前基础状态
    } else {
      currentStretchFrame.value = frame
    }
  }, 300) // 每帧 300ms
}

// 触发跳跃动画
function triggerJump() {
  setCatState('jumping')
  currentJumpFrame.value = 0
  let frame = 0
  clearActionInterval()
  actionInterval = setInterval(() => {
    frame++
    if (frame >= jumpFrames.length) {
      clearActionInterval()
      restoreBaseCatState() // 跳跃完回到当前基础状态
    } else {
      currentJumpFrame.value = frame
    }
  }, 240) // 每帧 240ms
}

// 开启 10s 周期倒计时
function startPeriodicTimer(actionType) {
  stopPeriodicTimer()
  periodicTimer = setInterval(() => {
    if (actionType === 'stretch' && catState.value === 'sleep') {
      triggerStretch()
    } else if (actionType === 'jump' && catState.value === 'play' && !isFloatingMode.value) {
      triggerJump()
    }
  }, 10000) // 每 10s 触发一次
}

function stopPeriodicTimer() {
  if (periodicTimer) {
    clearInterval(periodicTimer)
    periodicTimer = null
  }
}

// 获取今天日期的字符串格式
function getTodayString() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const lastFedDate = ref(localStorage.getItem('cs_valley_last_fed_date') || '')

// 监听基础状态与悬浮窗模式，自动调度对应的底层动画和计时器
watch([isFloatingMode, lastFedDate], () => {
  syncCatStateToBase()
  stopBaseAnimation()
  stopPeriodicTimer()

  startBaseAnimation()

  if (isFloatingMode.value) {
    return
  }

  if (catState.value === 'sleep') {
    startPeriodicTimer('stretch')
  } else if (catState.value === 'play') {
    startPeriodicTimer('jump')
  }
}, { immediate: true })

function resetCatState(delay = 2000) {
  clearCatStateTimer()
  catStateTimer = setTimeout(() => {
    restoreBaseCatState()
  }, delay)
}

function feedCat() {
  if (foodStock.value < 10) {
    setCatState('refused', CAT_MESSAGES.refused)
    resetCatState(2500)
    return
  }

  catExp.value += 10
  feedCount.value++
  foodStock.value -= 10
  
  setCatState('eating', CAT_MESSAGES.eating)

  clearCatStateTimer()
  catStateTimer = setTimeout(() => {
    restoreBaseCatState()

    const todayStr = getTodayString()
    lastFedDate.value = todayStr
    localStorage.setItem('cs_valley_last_fed_date', todayStr)
  }, 1500)
}

function interactWithCat() {
  if (catState.value === 'eating' || catState.value === 'lifted') return 

  setCatState('happy', CAT_MESSAGES.happy)
  resetCatState(2000)
}

function waterPlant() {
  if (waterStock.value < WATER_COST) {
    message.value = `🚿 水滴不足，浇水需要 ${WATER_COST} 份水滴！`
    resetCatState(2000)
    return
  }

  waterCount.value++
  waterStock.value = Math.max(waterStock.value - WATER_COST, 0)

  const termKey = currentTermPinyin.value
  const currentWaterings = plantWaterByTerm.value[termKey] || 0
  if (currentWaterings < MAX_WATERINGS_PER_TERM) {
    plantWaterByTerm.value = {
      ...plantWaterByTerm.value,
      [termKey]: currentWaterings + 1
    }
  }

  message.value = CAT_MESSAGES.watering
  resetCatState(2000)
}

function resetToday() {
  // 重置今日统计
  feedCount.value = 0
  waterCount.value = 0
  todayPassed.value = 0
  todayErrors.value = 0

  // 清除喂食记录，让猫可以重新喂食
  lastFedDate.value = ''
  localStorage.removeItem('cs_valley_last_fed_date')

  // 强制猫回到睡觉状态，清除所有定时器影响
  clearCatStateTimer()
  stopBaseAnimation()
  stopPeriodicTimer()
  clearActionInterval()

  restoreBaseCatState()
}

// ==========================================
// 4. 插件数据更新监听 (🌟 接入缓冲池)
// ==========================================
function applyActivityUpdate(data) {
  if (!isAuthenticated.value) return
  if (!data || typeof data !== 'object') return
  if (isSandboxActive.value) return

  if (typeof data.codeAdded === 'number' && Number.isFinite(data.codeAdded) && data.codeAdded > 0) {
    codeLines.value = Math.max(0, codeLines.value + data.codeAdded)
    pendingSync.value.codeLines += data.codeAdded // 🌟 存入缓冲池
    pendingSync.value.archiveCodeLines = Math.max(0, Number(pendingSync.value.archiveCodeLines || 0)) + data.codeAdded
  }

  if (typeof data.codePassed === 'number' && Number.isFinite(data.codePassed) && data.codePassed > 0) {
    catExp.value += data.codePassed * 5
    todayPassed.value += data.codePassed
    pendingSync.value.commitCount += data.codePassed // 🌟 存入缓冲池 (暂用通过数代表提交数)
    
    message.value = `✅ ${data.codePassed} 个文件通过，经验提升中...`
    catState.value = 'happy'
    resetCatState(2500)
  }

  if (typeof data.errorCount === 'number' && Number.isFinite(data.errorCount) && data.errorCount > 0) {
    todayErrors.value += data.errorCount
    pendingSync.value.errorCount += data.errorCount // 🌟 存入缓冲池
    
    message.value = `⚠️ 发现 ${data.errorCount} 个新错误，快去看看吧！`
    catState.value = 'refused' 
    resetCatState(3000)
  }
}

// 经验条计算
const activeGridCount = computed(() => {
  return Math.min(Math.floor(codeLines.value / CODE_LINES_PER_REWARD), 5)
})

const rewardedCodeThreshold = computed(() => {
  return Math.max(0, Math.floor(codeLines.value / CODE_LINES_PER_REWARD))
})

const highestRewardedThreshold = ref(rewardedCodeThreshold.value)

watch(rewardedCodeThreshold, (newValue) => {
  if (suppressResourceRewards.value) return

  if (newValue > highestRewardedThreshold.value) {
    const oldValue = highestRewardedThreshold.value
    const gainedThresholds = newValue - oldValue
    const bonus = gainedThresholds * RESOURCE_PER_REWARD
    const maxWaterThreshold = Math.floor(MAX_WATER_REWARDED_LINES / CODE_LINES_PER_REWARD)
    const gainedWaterThresholds = Math.max(
      0,
      Math.min(newValue, maxWaterThreshold) - Math.min(oldValue, maxWaterThreshold)
    )

    foodStock.value += bonus
    waterStock.value += gainedWaterThresholds * RESOURCE_PER_REWARD
    highestRewardedThreshold.value = newValue
  }
})

// ==========================================
// 5. 辅助功能 (节气档案、设置)
// ==========================================
async function openArchive() {
  isArchiveOpen.value = true
  hasNewHarvest.value = false
  hasNewReport.value = false
  selectedArchiveTermKey.value = getDefaultArchiveTermKey()
  message.value = '📖 正在打开节气档案...'
  resetCatState(2000)

  // 🌟 新增：每次翻开档案，自动拉取后端历史报告
  if (cloudToken.value) {
    try {
      const res = await fetchHistoryReports(cloudToken.value)
      if (res.success && res.data) {
        const cloudReports = {}
        const cloudHarvests = {}
        res.data.forEach(report => {
          const termKey = solarTermMap[report.solarTerm]
          if (termKey && !cloudReports[termKey]) {
            // 🛠️ 核心修复：处理后台增量为0，但实际有总资产的情况
            let displayCodeLines = report.totalCodeLines
            const reportSummary = String(report.summary || '')
            const match = reportSummary.match(/总代码资产为 (\d+) 行/)
            if (match) {
              displayCodeLines = parseInt(match[1], 10) // 把文案里的真实行数抠出来显示
            }

            cloudReports[termKey] = {
              termName: report.solarTerm,
              termKey: termKey,
              title: `${report.solarTerm}结算周报`,
              date: `${report.periodStart} 生成`,
              owner: loggedInUser.value || '本地种植者',
              totalCodeLines: displayCodeLines, // 👈 使用修复后的数值
              todayPassed: report.totalCommitCount,
              todayErrors: report.totalErrorCount,
              passRate: formatPassRate(report.totalCommitCount, report.totalErrorCount),
              totalActions: '已归档',
              plantStage: report.harvestTier && Number.isFinite(Number(report.plantStage)) ? Number(report.plantStage) : '已归档',
              syncText: '☁️ 云端永久快照',
              summary: reportSummary
            }

            const restoredHarvest = buildHarvestRecordFromReport(report, termKey)
            if (restoredHarvest) {
              cloudHarvests[termKey] = restoredHarvest
            }
          }
        })
        // 将云端报告覆盖到本地 UI 数据中
        reportRecords.value = { ...reportRecords.value, ...cloudReports }
        const mergedHarvestRecords = { ...harvestRecords.value }
        Object.values(cloudHarvests).forEach((record) => {
          const existing = mergedHarvestRecords[record.termKey]
          if (!existing || harvestTierRank[existing.tier] <= harvestTierRank[record.tier]) {
            mergedHarvestRecords[record.termKey] = record
          }
        })
        harvestRecords.value = mergedHarvestRecords
        
        if (!selectedArchiveTermKey.value) {
            selectedArchiveTermKey.value = getDefaultArchiveTermKey()
        }
      }
    } catch (error) {
      console.error('拉取云端历史报告失败:', error)
    }
  }
}

// 🌟 新增：主动向云端请求当前节气统计并生成新报告
async function generateAndSaveCloudReport() {
  if (!cloudToken.value) {
    message.value = '⚠️ 请先登录账号再生成云端报告！'
    resetCatState(3000)
    return
  }

  const selectedTerm = selectedArchiveTerm.value
  if (!selectedTerm) {
    message.value = '⚠️ 请先在节气档案中选择一个节气。'
    resetCatState(3000)
    return
  }

  const termName = selectedTerm.name
  const termKey = selectedTerm.key

  if (selectedArchiveReportRecord.value) {
    message.value = `📖 ${termName} 的节气报告已经生成，可以直接查看。`
    resetCatState(3000)
    return
  }

  if (!isSolarTermEndedForReport(termName)) {
    message.value = selectedArchiveIsCurrentTerm.value
      ? '当前节气还在生长中，还未生成节气报告。'
      : `${termName} 还未进入结算时间，还未生成节气报告。`
    resetCatState(3000)
    return
  }

  message.value = `📊 正在向云端请求 ${termName} 的统计数据...`

  try {
    const statsRes = await fetchTermStats(cloudToken.value, termName)
    if (!statsRes.success) throw new Error(statsRes.message)

    const data = statsRes.data
    const passRate = formatPassRate(data.totalCommitCount, data.totalErrorCount)
    const summaryText = `${SOLAR_TERM_REPORT_YEAR} 年${termName}节气已结算。云端记录显示：本节气期间累计编写代码 ${data.totalCodeLines} 行，通过/提交 ${data.totalCommitCount} 次，发生报错 ${data.totalErrorCount} 次，通过率 ${passRate}。`

    const stage = selectedArchiveHarvestRecord.value?.stage || getPlantStageByWaterings(plantWaterByTerm.value[termKey] || 0)
    const tier = getHarvestTierByStage(stage)
    const harvestStage = getHarvestStageByPlantStage(stage)
    const harvestItemName = getHarvestPlantName(termName, termKey)
    const period = getSolarTermPeriod2026(termName)
    const reportPayload = {
      solarTerm: termName,
      periodStart: period.start,
      periodEnd: period.end,
      summary: summaryText,
      plantStage: stage,
      harvestStage,
      harvestTier: tier,
      harvestItemName
    }

    const saveResult = await saveTermReport(cloudToken.value, reportPayload)
    const savedReport = saveResult.data || reportPayload
    saveReportRecord({
      termName,
      termKey,
      title: `${termName}结算周报`,
      date: `${savedReport.periodStart || getTodayString()} 生成`,
      owner: loggedInUser.value || '本地种植者',
      totalCodeLines: savedReport.totalCodeLines ?? data.totalCodeLines,
      todayPassed: savedReport.totalCommitCount ?? data.totalCommitCount,
      todayErrors: savedReport.totalErrorCount ?? data.totalErrorCount,
      passRate: formatPassRate(savedReport.totalCommitCount ?? data.totalCommitCount, savedReport.totalErrorCount ?? data.totalErrorCount),
      totalActions: '已归档',
      plantStage: stage,
      syncText: '☁️ 云端永久快照',
      summary: summaryText
    })
    latestReportTermKey.value = termKey

    message.value = `✨ ${termName} 云端报告已永久保存！`
    resetCatState(3000)
    await openArchive()
  } catch (error) {
    message.value = `❌ 生成报告失败: ${error.message}`
    resetCatState(3000)
  }
}

function closeArchive() {
  isArchiveOpen.value = false
  selectedArchiveTermKey.value = ''
  closeImagePreview()
}
function selectArchiveTerm(termKey) {
  selectedArchiveTermKey.value = termKey
}
function openImagePreview(src, alt) {
  if (!src) return
  previewImage.value = { src, alt }
}
function closeImagePreview() {
  previewImage.value = null
}

function openSettings() {
  isSettingsPanelOpen.value = true
}

function closeSettings() {
  isSettingsPanelOpen.value = false
  isCloudAccountPanelOpen.value = false
}

function openCloudAccountPanel() {
  isCloudAccountPanelOpen.value = true
}

function closeCloudAccountPanel() {
  isCloudAccountPanelOpen.value = false
}

function openUserProfilePanel() {
  isUserProfilePanelOpen.value = true
}

function closeUserProfilePanel() {
  isUserProfilePanelOpen.value = false
}

async function saveUserProfile() {
  if (!cloudToken.value) {
    authStatusMessage.value = '请先登录账号再保存个人资料'
    return
  }

  isCloudBusy.value = true
  try {
    const result = await updateUserProfile(cloudToken.value, {
      nickname: userNickname.value,
      birthday: userBirthday.value
    })
    applyCloudSave(result.data)
    authStatusMessage.value = '个人资料已保存'
    closeUserProfilePanel()
  } catch (error) {
    if (error.status === 401) clearAuthSession()
    authStatusMessage.value = `个人资料保存失败：${error.message}`
  } finally {
    isCloudBusy.value = false
  }
}

function toggleStats() {
  isStatsVisible.value = !isStatsVisible.value
}

// ==========================================
// 6. 日期、节气与环境表现
// ==========================================
const now = ref(new Date())
let timerId = null

const currentDate = computed(() => {
  const targetDate = isValidDateObj(effectiveDate.value) ? effectiveDate.value : now.value
  const year = targetDate.getFullYear()
  const month = String(targetDate.getMonth() + 1).padStart(2, '0')
  const day = String(targetDate.getDate()).padStart(2, '0')
  return `${year}年${month}月${day}日`
})

function getSolarTerm(date) {
  const month = date.getMonth()
  const day = date.getDate()
  const year = date.getFullYear()
  return getActiveJieQi(year, month + 1, day)
}

const currentSolarTerm = computed(() => {
  const dt = isValidDateObj(effectiveDate.value) ? effectiveDate.value : now.value
  try {
    return getSolarTerm(dt) || ''
  } catch {
    return ''
  }
})

const currentWeatherType = computed(() => {
  const term = currentSolarTerm.value;
  const rainTerms = ['雨水', '谷雨', '清明'];
  const snowTerms = ['小雪', '大雪', '冬至', '小寒', '大寒'];

  if (rainTerms.includes(term)) return 'rain';
  if (snowTerms.includes(term)) return 'snow';
  return 'none';
})

const solarTermMap = {
  '立春': 'lichun', '雨水': 'yushui', '惊蛰': 'jingzhe', '春分': 'chunfen',
  '清明': 'qingming', '谷雨': 'guyu', '立夏': 'lixia', '小满': 'xiaoman',
  '芒种': 'mangzhong', '夏至': 'xiazhi', '小暑': 'xiaoshu', '大暑': 'dashu',
  '立秋': 'liqiu', '处暑': 'chushu', '白露': 'bailu', '秋分': 'qiufen',
  '寒露': 'hanlu', '霜降': 'shuangjiang', '立冬': 'lidong', '小雪': 'xiaoxue',
  '大雪': 'daxue', '冬至': 'dongzhi', '小寒': 'xiaohan', '大寒': 'dahan'
}
const solarTermNames = Object.keys(solarTermMap)
const solarTermEntries = solarTermNames.map((name) => ({ name, key: solarTermMap[name] }))

function formatDateForApi(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

function formatPassRate(passCount, errorCount) {
  const passed = Math.max(0, Number(passCount || 0))
  const errors = Math.max(0, Number(errorCount || 0))
  const total = passed + errors
  if (total === 0) return '暂无检测记录'
  return `${Math.round((passed / total) * 100)}%`
}

function buildSolarTermTimeline2026() {
  const timeline = []
  let previousTerm = ''
  for (let month = 0; month < 12; month++) {
    const days = SolarUtil.getDaysOfMonth(SOLAR_TERM_REPORT_YEAR, month + 1)
    for (let day = 1; day <= days; day++) {
      const date = makeLocalDate(SOLAR_TERM_REPORT_YEAR, month + 1, day)
      const termName = getSolarTermNameForDate(date)
      if (!termName || termName === previousTerm || !solarTermMap[termName]) continue
      timeline.push({
        name: termName,
        key: solarTermMap[termName],
        startDate: date
      })
      previousTerm = termName
    }
  }
  if (
    timeline[0] &&
    timeline[0].startDate.getMonth() === 0 &&
    timeline[0].startDate.getDate() === 1
  ) {
    timeline.shift()
  }
  return timeline
}

const solarTermTimeline2026 = buildSolarTermTimeline2026()

function getSolarTermTimelineIndex(termName) {
  return solarTermTimeline2026.findIndex((entry) => entry.name === termName)
}

function getCurrentTimelineIndex() {
  const currentDateValue = isValidDateObj(effectiveDate.value) ? effectiveDate.value : now.value
  if (currentDateValue.getFullYear() !== SOLAR_TERM_REPORT_YEAR) return -1
  return getSolarTermTimelineIndex(currentSolarTerm.value)
}

function getSolarTermPeriod2026(termName) {
  const index = getSolarTermTimelineIndex(termName)
  if (index < 0) return { start: getTodayString(), end: getTodayString() }
  const startDate = solarTermTimeline2026[index].startDate
  const nextStartDate = solarTermTimeline2026[index + 1]?.startDate
  const endDate = nextStartDate
    ? makeLocalDate(nextStartDate.getFullYear(), nextStartDate.getMonth() + 1, nextStartDate.getDate() - 1)
    : makeLocalDate(SOLAR_TERM_REPORT_YEAR, 12, 31)
  return { start: formatDateForApi(startDate), end: formatDateForApi(endDate) }
}

function isSolarTermEndedForReport(termName) {
  const selectedIndex = getSolarTermTimelineIndex(termName)
  const currentIndex = getCurrentTimelineIndex()
  if (selectedIndex < 0 || currentIndex < 0) return false
  return currentIndex > selectedIndex || settledSolarTerms.value.includes(termName)
}

function markSolarTermSettled(termName) {
  if (!termName || !solarTermMap[termName] || settledSolarTerms.value.includes(termName)) return
  settledSolarTerms.value = [...settledSolarTerms.value, termName]
}

function checkSolarTermTransition() {
  const termName = currentSolarTerm.value
  if (!termName) return

  if (lastSeenSolarTerm.value && lastSeenSolarTerm.value !== termName) {
    markSolarTermSettled(lastSeenSolarTerm.value)
  }

  lastSeenSolarTerm.value = termName
  localStorage.setItem(LAST_SEEN_SOLAR_TERM_KEY, termName)
}

function getDefaultArchiveTermKey() {
  if (
    latestHarvestTermKey.value &&
    (harvestRecords.value[latestHarvestTermKey.value] || reportRecords.value[latestHarvestTermKey.value])
  ) return latestHarvestTermKey.value
  if (
    latestReportTermKey.value &&
    (harvestRecords.value[latestReportTermKey.value] || reportRecords.value[latestReportTermKey.value])
  ) return latestReportTermKey.value
  const firstRecordedTerm = solarTermEntries.find((term) => {
    return harvestRecords.value[term.key] || reportRecords.value[term.key]
  })
  return currentTermPinyin.value || firstRecordedTerm?.key || solarTermEntries[0]?.key || ''
}

const DEFAULT_PLANT_TERM = 'xiazhi'
const DEFAULT_PLANT_STAGE = 1
const plantImageModules = import.meta.glob('./assets/*/stage*.png', {
  eager: true,
  import: 'default'
})
// 未解锁 / 已解锁 图标集合（按文件名匹配节气拼音）
const lockedModules = import.meta.glob('./assets/locked/*.png', { eager: true, import: 'default' })
const unlockedModules = import.meta.glob('./assets/unlocked/*.png', { eager: true, import: 'default' })

function getArchiveCellImage(termKey, hasRecord) {
  const modules = hasRecord ? unlockedModules : lockedModules
  
  // 1. 尝试模糊匹配文件名
  for (const p in modules) {
    const name = p.split('/').pop().toLowerCase()
    if (name.includes(termKey.toLowerCase())) return modules[p]
  }
  
  // 2. 🌟 修复错位：如果是已解锁状态但对应的彩色图没找到，强制退回到未解锁图，绝不拿别的节气顶替！
  if (hasRecord) {
    for (const p in lockedModules) {
      const name = p.split('/').pop().toLowerCase()
      if (name.includes(termKey.toLowerCase())) return lockedModules[p]
    }
  }
  
  // 3. 宁可空白也绝不错位
  return ''
}
const harvestImageModules = import.meta.glob('./assets/harvest/*/stage*.png', {
  eager: true,
  import: 'default'
})
const solarTermImageModules = import.meta.glob('./assets/SolarTerm/*.png', {
  eager: true,
  import: 'default'
})
const fallbackHarvestImage = new URL('./assets/harvest/harvest-seedling.png', import.meta.url).href
const harvestTierRank = {
  seedling: 1,
  mature: 2,
  premium: 3
}
const solarTermPlantMap = {
  '立春': '迎春花',
  '雨水': '杏花',
  '惊蛰': '月季',
  '春分': '梨花',
  '清明': '泡桐',
  '谷雨': '牡丹',
  '立夏': '小麦',
  '小满': '虞美人',
  '芒种': '栀子花',
  '夏至': '南瓜',
  '小暑': '芭蕉',
  '大暑': '凤仙花',
  '立秋': '蓝雪花',
  '处暑': '玉簪',
  '白露': '昙花',
  '秋分': '菊花',
  '寒露': '桂花',
  '霜降': '桔梗',
  '立冬': '一品红',
  '小雪': '茶花',
  '大雪': '仙客来',
  '冬至': '腊梅',
  '小寒': '水仙',
  '大寒': '兰花'
}
const harvestRecords = ref({})
const reportRecords = ref({})

const currentTermPinyin = computed(() => {
  const termName = (currentSolarTerm.value || '').trim()
  return solarTermMap[termName] || DEFAULT_PLANT_TERM
})

const currentBgUrl = computed(() => {
  const termName = (currentSolarTerm.value || '').trim();
  const pinyin = solarTermMap[termName];
  if (pinyin) {
    return new URL(`./assets/SolarTerm/${pinyin}.png`, import.meta.url).href;
  }
  return new URL('./assets/background.png', import.meta.url).href;
})

function getPlantStageByWaterings(waterings) {
  if (waterings >= 4) return 4 // 120
  if (waterings >= 3) return 3 // 60
  if (waterings >= 2) return 2 // 30
  return 1
}

function getMinimumWateringsForPlantStage(stage) {
  const targetStage = Math.max(1, Math.min(4, Number(stage) || 1))
  for (let waterings = 0; waterings <= MAX_WATERINGS_PER_TERM; waterings++) {
    if (getPlantStageByWaterings(waterings) >= targetStage) return waterings
  }
  return MAX_WATERINGS_PER_TERM
}

function getHarvestTierByStage(stage) {
  if (stage >= 4) return 'premium'
  if (stage >= 3) return 'mature'
  return 'seedling'
}

function getHarvestStageByPlantStage(stage) {
  if (stage >= 4) return 3
  if (stage >= 3) return 2
  return 1
}

function getHarvestPlantName(termName, termKey) {
  const normalizedTermName = String(termName || '').trim()
  const termFromKey = solarTermEntries.find((entry) => entry.key === termKey)
  return solarTermPlantMap[normalizedTermName] || solarTermPlantMap[termFromKey?.name] || '节气花果'
}

function getHarvestStageMessage(stage) {
  const safeStage = Math.max(1, Math.min(4, Number(stage) || 1))
  if (safeStage >= 4) return '这次代码量非常亮眼，像把整个节气都照亮了。真的很棒！'
  if (safeStage >= 3) return '代码量不错，这次积累很扎实，能看见你认真推进的节奏。辛苦啦，继续保持。'
  return '这次代码积累还在发芽期，已经留下了开始的痕迹。慢慢来，下一次会长得更稳。'
}

function buildHarvestMessage(plantName, stage) {
  return `这是你收获的${plantName}！${getHarvestStageMessage(stage)}`
}

function getHarvestImageUrlByHarvestStage(termKey, harvestStage) {
  const safeTermKey = solarTermEntries.some((term) => term.key === termKey) ? termKey : DEFAULT_PLANT_TERM
  const safeHarvestStage = Math.max(1, Math.min(3, Number(harvestStage) || 1))
  const imageKey = `./assets/harvest/${safeTermKey}/stage${safeHarvestStage}.png`
  const fallbackKey = `./assets/harvest/${DEFAULT_PLANT_TERM}/stage1.png`

  return harvestImageModules[imageKey] || harvestImageModules[fallbackKey] || fallbackHarvestImage
}

function getHarvestImageUrl(termKey, plantStage) {
  return getHarvestImageUrlByHarvestStage(termKey, getHarvestStageByPlantStage(plantStage))
}

function buildHarvestRecordFromReport(report, termKey) {
  const tier = String(report.harvestTier || '')
  if (!harvestTierRank[tier]) return null

  const term = solarTermEntries.find((entry) => entry.key === termKey)
  const plantStage = Math.max(1, Math.min(4, Number(report.plantStage) || 1))
  const harvestStage = Math.max(1, Math.min(3, Number(report.harvestStage) || getHarvestStageByPlantStage(plantStage)))
  const termName = term?.name || String(report.solarTerm || '')
  const itemName = getHarvestPlantName(termName, termKey)

  return {
    termName,
    termKey,
    stage: plantStage,
    tier,
    itemName,
    image: getHarvestImageUrlByHarvestStage(termKey, harvestStage),
    message: buildHarvestMessage(itemName, plantStage)
  }
}

const currentPlantStage = computed(() => {
  const waterings = plantWaterByTerm.value[currentTermPinyin.value] || 0
  return getPlantStageByWaterings(waterings)
})

const selectedArchiveTerm = computed(() => {
  return solarTermEntries.find((term) => term.key === selectedArchiveTermKey.value) || null
})

const selectedArchiveHarvestRecord = computed(() => {
  if (!selectedArchiveTermKey.value) return null
  return harvestRecords.value[selectedArchiveTermKey.value] || null
})

const selectedArchiveReportRecord = computed(() => {
  if (!selectedArchiveTermKey.value) return null
  return reportRecords.value[selectedArchiveTermKey.value] || null
})

const selectedArchiveHasRecord = computed(() => {
  return Boolean(selectedArchiveHarvestRecord.value)
})

const selectedArchiveHasArchiveContent = computed(() => {
  return Boolean(selectedArchiveHarvestRecord.value || selectedArchiveReportRecord.value)
})

const selectedArchiveIsCurrentTerm = computed(() => {
  return Boolean(selectedArchiveTerm.value && selectedArchiveTerm.value.name === currentSolarTerm.value)
})

const selectedArchiveIsEndedForReport = computed(() => {
  return Boolean(selectedArchiveTerm.value && isSolarTermEndedForReport(selectedArchiveTerm.value.name))
})

const canGenerateSelectedTermReport = computed(() => {
  return Boolean(cloudToken.value && selectedArchiveTerm.value && !selectedArchiveReportRecord.value && selectedArchiveIsEndedForReport.value)
})

const selectedArchiveSolarTermImage = computed(() => {
  if (!selectedArchiveTerm.value || (!selectedArchiveHasArchiveContent.value && !selectedArchiveIsCurrentTerm.value)) return ''
  return solarTermImageModules[`./assets/SolarTerm/${selectedArchiveTerm.value.key}.png`] || ''
})

const archiveCells = computed(() => {
  return solarTermEntries.map((term) => ({
    ...term,
    harvestRecord: harvestRecords.value[term.key] || null,
    reportRecord: reportRecords.value[term.key] || null,
    hasRecord: Boolean(harvestRecords.value[term.key] || reportRecords.value[term.key]),
    isLatest: latestHarvestTermKey.value === term.key || latestReportTermKey.value === term.key,
    isSelected: selectedArchiveTermKey.value === term.key
  }))
})

const plantImageConfig = {
  default: {
    width: '95px', left: '200px', bottom: '0px',
    transform: 'scale(5)', transformOrigin: 'bottom center'
  },
  lichun: { 
    default: { width: '100px', left: '450px', bottom: '160px', transform: 'scale(3.5)', transformOrigin: 'bottom center' },
    stage1: { width: '100px', left: '450px', bottom: '160px', transform: 'scale(2)', transformOrigin: 'bottom center' },
    stage2: { width: '100px', left: '450px', bottom: '160px', transform: 'scale(3)', transformOrigin: 'bottom center' },
    stage3: {}, stage4: {}
  },
  yushui: { 
    default: { width: '100px', left: '450px', bottom: '160px', transform: 'scale(4)', transformOrigin: 'bottom center' },
    stage1: { bottom: '80px' }, stage2: { bottom: '170px' }, stage3: { bottom: '140px' }, stage4: {}
  },
  jingzhe: { 
    default: { width: '100px', left: '450px', bottom: '180px', transform: 'scale(4)', transformOrigin: 'bottom center' },
    stage2: { bottom: '120px' },
    stage1: { width: '100px', left: '450px', bottom: '150px', transform: 'scale(3)', transformOrigin: 'bottom center' },
    stage3: { bottom: '150px' }, stage4: {}
  },
  chunfen: { 
    default: { width: '100px', left: '450px', bottom: '160px', transform: 'scale(4)', transformOrigin: 'bottom center' },
    stage1: { width: '100px', left: '450px', bottom: '160px', transform: 'scale(2)', transformOrigin: 'bottom center' },
    stage2: { transform: 'scale(3)' }, stage3: {}, stage4: {}
  },
  qingming: { 
    default: { width: '100px', left: '450px', bottom: '160px', transform: 'scale(3.5)', transformOrigin: 'bottom center' },
    stage1: {}, stage2: { bottom: '150px' }, stage3: {}, stage4: {}
  },
  guyu: { 
    default: { width: '100px', left: '450px', bottom: '160px', transform: 'scale(4)', transformOrigin: 'bottom center' },
    stage1: { width: '100px', left: '450px', bottom: '100px', transform: 'scale(4)', transformOrigin: 'bottom center' },
    stage2: { width: '100px', left: '450px', bottom: '160px', transform: 'scale(4)', transformOrigin: 'bottom center' },
    stage3: { width: '100px', left: '450px', bottom: '120px', transform: 'scale(4)', transformOrigin: 'bottom center' },
    stage4: { width: '100px', left: '450px', bottom: '160px', transform: 'scale(3.5)', transformOrigin: 'bottom center' }
  },
    // 夏季节气（采用 main 分支数值）
  lixia: {
    default: { width: '100px', left: '450px', bottom: '160px', transform: 'scale(4)', transformOrigin: 'bottom center' },
    stage1: {}, stage2: {}, stage3: {}, stage4: {}
  },
  xiaoman: {
    default: { width: '100px', left: '440px', bottom: '120px', transform: 'scale(2.5)', transformOrigin: 'bottom center' },
    stage1: {}, stage2: {}, stage3: {}, stage4: {}
  },
  mangzhong: {
    default: { width: '100px', left: '450px', bottom: '160px', transform: 'scale(4)', transformOrigin: 'bottom center' },
    stage1: {}, stage2: {}, stage3: {}, stage4: {}
  },
  xiazhi: {
    default: { width: '100px', left: '450px', bottom: '160px', transform: 'scale(4.5)', transformOrigin: 'bottom center' },
    stage1: {}, stage2: {}, stage3: {}, stage4: {}
  },
  xiaoshu: {
    default: { width: '100px', left: '450px', bottom: '160px', transform: 'scale(5)', transformOrigin: 'bottom center' },
    stage1: { transform: 'scale(2.5)', bottom: '160px' },
    stage2: {}, stage3: {}, stage4: {}
  },
  dashu: {
    default: { width: '100px', left: '450px', bottom: '160px', transform: 'scale(2.5)', transformOrigin: 'bottom center' },
    stage1: { bottom: '140px' },
    stage2: {}, stage3: {}, stage4: {}
  },

  // 初秋节气（保留 update_cat_v2 分支）
  liqiu: {
    default: { width: '100px', left: '450px', bottom: '160px', transform: 'scale(4)', transformOrigin: 'bottom center' },
    stage1: { width: '100px', left: '450px', bottom: '170px', transform: 'scale(2)', transformOrigin: 'bottom center' },
    stage2: { width: '100px', left: '450px', bottom: '160px', transform: 'scale(2.5)', transformOrigin: 'bottom center' },
    stage3: { width: '100px', left: '450px', bottom: '160px', transform: 'scale(3)', transformOrigin: 'bottom center' },
    stage4: { width: '100px', left: '450px', bottom: '160px', transform: 'scale(3.5)', transformOrigin: 'bottom center' }
  },
  chushu: {
    default: { width: '100px', left: '450px', bottom: '160px', transform: 'scale(4)', transformOrigin: 'bottom center' },
    stage1: { width: '100px', left: '450px', bottom: '170px', transform: 'scale(1.5)', transformOrigin: 'bottom center' },
    stage2: { width: '100px', left: '450px', bottom: '160px', transform: 'scale(2.5)', transformOrigin: 'bottom center' },
    stage3: { width: '100px', left: '450px', bottom: '160px', transform: 'scale(2.5)', transformOrigin: 'bottom center' },
    stage4: { width: '100px', left: '450px', bottom: '160px', transform: 'scale(2.8)', transformOrigin: 'bottom center' }
  },
  bailu: {
    default: { width: '100px', left: '450px', bottom: '160px', transform: 'scale(4)', transformOrigin: 'bottom center' },
    stage1: { width: '100px', left: '450px', bottom: '170px', transform: 'scale(1.5)', transformOrigin: 'bottom center' },
    stage2: { width: '100px', left: '450px', bottom: '160px', transform: 'scale(2)', transformOrigin: 'bottom center' },
    stage3: { width: '100px', left: '450px', bottom: '160px', transform: 'scale(2.5)', transformOrigin: 'bottom center' },
    stage4: { width: '100px', left: '450px', bottom: '160px', transform: 'scale(2.5)', transformOrigin: 'bottom center' }
  },
  qiufen: { 
    default: { width: '100px', left: '450px', bottom: '160px', transform: 'scale(4)', transformOrigin: 'bottom center' },
    stage1: { width: '100px', left: '450px', bottom: '170px', transform: 'scale(1.5)', transformOrigin: 'bottom center' },
    stage2: { width: '100px', left: '450px', bottom: '160px', transform: 'scale(1.8)', transformOrigin: 'bottom center' },
    stage3: { width: '100px', left: '450px', bottom: '160px', transform: 'scale(2.2)', transformOrigin: 'bottom center' },
    stage4: { width: '100px', left: '450px', bottom: '160px', transform: 'scale(2)', transformOrigin: 'bottom center' }
  },
  hanlu: { 
    default: { width: '100px', left: '450px', bottom: '160px', transform: 'scale(4)', transformOrigin: 'bottom center' },
    stage1: { width: '100px', left: '450px', bottom: '170px', transform: 'scale(2)', transformOrigin: 'bottom center' },
    stage2: { width: '100px', left: '450px', bottom: '160px', transform: 'scale(3)', transformOrigin: 'bottom center' },
    stage3: { width: '100px', left: '450px', bottom: '160px', transform: 'scale(3)', transformOrigin: 'bottom center' },
    stage4: { width: '100px', left: '450px', bottom: '160px', transform: 'scale(3.5)', transformOrigin: 'bottom center' }
  },
  shuangjiang: { 
    default: { width: '100px', left: '450px', bottom: '160px', transform: 'scale(4)', transformOrigin: 'bottom center' },
    stage1: { width: '100px', left: '450px', bottom: '160px', transform: 'scale(2)', transformOrigin: 'bottom center' },
    stage2: { width: '100px', left: '450px', bottom: '160px', transform: 'scale(2)', transformOrigin: 'bottom center' },
    stage3: { width: '100px', left: '450px', bottom: '160px', transform: 'scale(2.5)', transformOrigin: 'bottom center' },
    stage4: { width: '100px', left: '450px', bottom: '160px', transform: 'scale(2)', transformOrigin: 'bottom center' }
  },
  lidong: { default: { width: '50px', left: '450px', bottom: '120px', transform: 'scale(4)', transformOrigin: 'bottom center' }, stage1: {}, stage2: {}, stage3: {}, stage4: {} },
  xiaoxue: { default: { width: '50px', left: '450px', bottom: '130px', transform: 'scale(4)', transformOrigin: 'bottom center' }, stage1: {}, stage2: {}, stage3: {}, stage4: {} },
  daxue: { default: { width: '60px', left: '450px', bottom: '110px', transform: 'scale(4)', transformOrigin: 'bottom center' }, stage1: {}, stage2: {}, stage3: {}, stage4: {} },
  dongzhi: { default: { width: '80px', left: '450px', bottom: '160px', transform: 'scale(4)', transformOrigin: 'bottom center' }, stage1: {}, stage2: {}, stage3: {}, stage4: {} },
  xiaohan: { default: { width: '60px', left: '450px', bottom: '130px', transform: 'scale(4)', transformOrigin: 'bottom center' }, stage1: {}, stage2: {}, stage3: {}, stage4: {} },
  dahan: { default: { width: '60px', left: '455px', bottom: '140px', transform: 'scale(4)', transformOrigin: 'bottom center' }, stage1: {}, stage2: {}, stage3: {}, stage4: {} }
};

function getPlantImageUrl(termKey, stage) {
  const imageKey = `./assets/${termKey}/stage${stage}.png`
  const fallbackKey = `./assets/${DEFAULT_PLANT_TERM}/stage${DEFAULT_PLANT_STAGE}.png`

  if (plantImageModules[imageKey]) return plantImageModules[imageKey]
  return plantImageModules[fallbackKey] || new URL('./assets/xiazhi/stage1.png', import.meta.url).href
}

const currentPlant = computed(() => {
  const termKey = currentTermPinyin.value
  const stage = currentPlantStage.value
  const termConfig = plantImageConfig[termKey] || {}
  const stageConfig = termConfig[`stage${stage}`] || {}
  const style = {
    ...plantImageConfig.default,
    ...(termConfig.default || {}),
    ...stageConfig
  }
  return { src: getPlantImageUrl(termKey, stage), style }
})

// ==========================================
// 7. 沙盘模式 (Time Machine)
// ==========================================
const SANDBOX_CODE_LINES = 6000
const mockDateString = ref(null)
const isTimeMachineOpen = ref(false)
const tmYear = ref('')
const tmMonth = ref('')
const tmDay = ref('')
const tmSettlementStage = ref(1)
const timeMachineError = ref('')
const tmYearInputEl = ref(null)
const sandboxSnapshot = ref(null)

function pad2(n) { return String(n).padStart(2, '0') }
function parseYmdString(ymd) {
  if (!ymd) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd)
  if (!m) return null
  return { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) }
}
function makeLocalDate(y, m, d) { return new Date(y, m - 1, d) }
function isValidDateObj(dt) { return dt instanceof Date && !Number.isNaN(dt.getTime()) }
function getSolarTermNameForDate(date) {
  try {
    return (getSolarTerm(date) || '').trim()
  } catch {
    return ''
  }
}
function getNextTermDate(date, currentTermName) {
  for (let i = 1; i <= 25; i++) {
    const candidate = makeLocalDate(date.getFullYear(), date.getMonth() + 1, date.getDate() + i)
    const candidateTermName = getSolarTermNameForDate(candidate)
    if (candidateTermName && candidateTermName !== currentTermName) return candidate
  }
  return makeLocalDate(date.getFullYear(), date.getMonth() + 1, date.getDate() + 15)
}
function validateTimeMachineDate() {
  const y = Number(tmYear.value), m = Number(tmMonth.value), d = Number(tmDay.value)
  if (!Number.isInteger(y) || y <= 0) { timeMachineError.value = '年份不合理'; return null }
  if (!Number.isInteger(m) || m < 1 || m > 12) { timeMachineError.value = '月份不合理'; return null }
  const maxDays = SolarUtil.getDaysOfMonth(y, m)
  if (!Number.isInteger(d) || d < 1 || d > maxDays) { timeMachineError.value = `日期不合理`; return null }
  return { y, m, d, date: makeLocalDate(y, m, d) }
}

const isSandboxActive = computed(() => !!parseYmdString(mockDateString.value))
const effectiveDate = computed(() => {
  const parsed = parseYmdString(mockDateString.value)
  const candidate = parsed ? makeLocalDate(parsed.y, parsed.m, parsed.d) : now.value
  return isValidDateObj(candidate) ? candidate : now.value
})

function captureCurrentState() {
  return {
    mockDateString: mockDateString.value,
    codeLines: codeLines.value,
    catExp: catExp.value,
    todayPassed: todayPassed.value,
    todayErrors: todayErrors.value,
    feedCount: feedCount.value,
    waterCount: waterCount.value,
    foodStock: foodStock.value,
    waterStock: waterStock.value,
    highestRewardedThreshold: highestRewardedThreshold.value,
    plantWaterByTerm: { ...plantWaterByTerm.value },
    harvestRecords: { ...harvestRecords.value },
    reportRecords: { ...reportRecords.value },
    hasNewHarvest: hasNewHarvest.value,
    hasNewReport: hasNewReport.value,
    latestHarvestTermKey: latestHarvestTermKey.value,
    latestReportTermKey: latestReportTermKey.value
  }
}

function restoreSnapshot(snapshot) {
  if (!snapshot) return
  mockDateString.value = snapshot.mockDateString
  catExp.value = snapshot.catExp
  todayPassed.value = snapshot.todayPassed
  todayErrors.value = snapshot.todayErrors
  feedCount.value = snapshot.feedCount
  waterCount.value = snapshot.waterCount
  foodStock.value = snapshot.foodStock
  waterStock.value = snapshot.waterStock
  plantWaterByTerm.value = { ...snapshot.plantWaterByTerm }
  harvestRecords.value = { ...(snapshot.harvestRecords || {}) }
  reportRecords.value = { ...(snapshot.reportRecords || {}) }
  hasNewHarvest.value = !!snapshot.hasNewHarvest
  hasNewReport.value = !!snapshot.hasNewReport
  latestHarvestTermKey.value = snapshot.latestHarvestTermKey || ''
  latestReportTermKey.value = snapshot.latestReportTermKey || ''
  selectedArchiveTermKey.value = ''
  isArchiveOpen.value = false
  suppressResourceRewards.value = true
  codeLines.value = snapshot.codeLines
  highestRewardedThreshold.value = snapshot.highestRewardedThreshold
  nextTick(() => suppressResourceRewards.value = false)
}

function openTimeMachine() {
  const parsed = parseYmdString(mockDateString.value)
  const base = parsed ? makeLocalDate(parsed.y, parsed.m, parsed.d) : now.value
  tmYear.value = String(base.getFullYear())
  tmMonth.value = pad2(base.getMonth() + 1)
  tmDay.value = pad2(base.getDate())
  timeMachineError.value = ''
  isTimeMachineOpen.value = true
  nextTick(() => tmYearInputEl.value?.focus?.())
}

function closeTimeMachine() {
  isTimeMachineOpen.value = false
  timeMachineError.value = ''
}

function applyTimeMachine() {
  const parsed = validateTimeMachineDate()
  if (!parsed) return

  if (!sandboxSnapshot.value) sandboxSnapshot.value = captureCurrentState()
  
  const sandboxDate = parsed.date
  mockDateString.value = `${parsed.y}-${pad2(parsed.m)}-${pad2(parsed.d)}`
  
  const termKey = getTermPinyinForDate(sandboxDate)
  suppressResourceRewards.value = true
  codeLines.value = SANDBOX_CODE_LINES
  highestRewardedThreshold.value = Math.max(0, Math.floor(SANDBOX_CODE_LINES / CODE_LINES_PER_REWARD))
  nextTick(() => suppressResourceRewards.value = false)
  
  foodStock.value = highestRewardedThreshold.value * RESOURCE_PER_REWARD
  waterStock.value = Math.min(highestRewardedThreshold.value, Math.floor(MAX_WATER_REWARDED_LINES / CODE_LINES_PER_REWARD)) * RESOURCE_PER_REWARD
  feedCount.value = 0
  waterCount.value = 0
  todayPassed.value = 0
  todayErrors.value = 0
  plantWaterByTerm.value = { [termKey]: getMinimumWateringsForPlantStage(tmSettlementStage.value) }
  isTimeMachineOpen.value = false
  timeMachineError.value = ''
  message.value = `⏳ 沙盘生效！前往 ${mockDateString.value}`
  resetCatState(3000)
}

function buildHarvestRecord(termName, termKey, stage) {
  const tier = getHarvestTierByStage(stage)
  const itemName = getHarvestPlantName(termName, termKey)
  return {
    termName,
    termKey,
    stage,
    tier,
    itemName,
    image: getHarvestImageUrl(termKey, stage),
    message: buildHarvestMessage(itemName, stage)
  }
}

function saveHarvestRecord(record) {
  const existing = harvestRecords.value[record.termKey]
  if (existing && harvestTierRank[existing.tier] > harvestTierRank[record.tier]) return existing

  harvestRecords.value = {
    ...harvestRecords.value,
    [record.termKey]: record
  }
  return record
}

function saveReportRecord(record) {
  reportRecords.value = {
    ...reportRecords.value,
    [record.termKey]: record
  }
  return record
}

function simulateTermSettlement() {
  const parsed = validateTimeMachineDate()
  if (!parsed) return
  if (!sandboxSnapshot.value) sandboxSnapshot.value = captureCurrentState()

  const settledDate = parsed.date
  const settledTermName = getSolarTermNameForDate(settledDate) || '当前节气'
  const settledTermKey = solarTermMap[settledTermName] || getTermPinyinForDate(settledDate)
  const stage = Math.max(1, Math.min(4, Number(tmSettlementStage.value) || 1))
  const waterings = getMinimumWateringsForPlantStage(stage)
  const totalActions = feedCount.value + waterings
  const record = saveHarvestRecord(buildHarvestRecord(settledTermName, settledTermKey, stage))
  const nextTermDate = getNextTermDate(settledDate, settledTermName)
  const nextTermKey = getTermPinyinForDate(nextTermDate)

  latestHarvestTermKey.value = settledTermKey
  latestReportTermKey.value = settledTermKey
  hasNewHarvest.value = true
  hasNewReport.value = true
  const reportRecord = {
    termName: settledTermName,
    termKey: settledTermKey,
    title: `${settledTermName}结算周报`,
    date: `${settledDate.getFullYear()}年${pad2(settledDate.getMonth() + 1)}月${pad2(settledDate.getDate())}日`,
    owner: loggedInUser.value || '本地用户',
    totalCodeLines: codeLines.value,
    todayPassed: todayPassed.value,
    todayErrors: todayErrors.value,
    passRate: todayPassed.value + todayErrors.value === 0
      ? '暂无检测记录'
      : `${Math.round((todayPassed.value / (todayPassed.value + todayErrors.value)) * 100)}%`,
    totalActions,
    plantStage: stage,
    syncText: '沙盘模拟结算，不会同步云端',
    summary: `${settledTermName}已结算，植物成长到第 ${stage} 阶段，图鉴收获：${record.itemName}。`
  }
  saveReportRecord(reportRecord)

  mockDateString.value = `${nextTermDate.getFullYear()}-${pad2(nextTermDate.getMonth() + 1)}-${pad2(nextTermDate.getDate())}`
  plantWaterByTerm.value = { [nextTermKey]: 0 }
  waterCount.value = 0
  isTimeMachineOpen.value = false
  isArchiveOpen.value = false
  message.value = `✨ ${settledTermName}结算完成，节气档案有新内容！`
  resetCatState(3000)
}

function exitTimeMachine() {
  restoreSnapshot(sandboxSnapshot.value)
  sandboxSnapshot.value = null
  mockDateString.value = null
  isTimeMachineOpen.value = false
  message.value = '⏰ 退出沙盘，恢复现实时间！'
  resetCatState(3000)
}

function getTermPinyinForDate(date) {
  try {
    const termName = (getSolarTerm(date) || '').trim()
    return solarTermMap[termName] || DEFAULT_PLANT_TERM
  } catch {
    return DEFAULT_PLANT_TERM
  }
}

// ==========================================
// 8. 生命周期管理 (包含跨日重置校验 & 🌟 挂载自动同步)
// ==========================================
onMounted(() => {
  checkHash()
  setupFloatingListeners()

  if (window.api?.onActivityUpdate) {
    offActivityUpdate = window.api.onActivityUpdate(applyActivityUpdate)
  }

  if (cloudToken.value) {
    loadCloudSave()
      .then(() => {
        isRestoringSession.value = false
        authStatusMessage.value = '已恢复登录状态，云端存档已加载'
        fetchLatestActivitySnapshot()
      })
      .catch((error) => {
        clearAuthSession()
        authStatusMessage.value = `登录状态失效：${error.message}`
      })
  } else {
    clearUserProfile()
  }
  
  updateUiScale()
  window.addEventListener('resize', updateUiScale)

  // 初始化时校验跨日状态
  restoreBaseCatState()
  checkSolarTermTransition()

  timerId = setInterval(() => {
    now.value = new Date()
    checkSolarTermTransition()

    // 跨日重置逻辑：每分钟检查一次，发现是第二天则清除状态
    const todayStr = getTodayString()
    if (lastFedDate.value && lastFedDate.value !== todayStr) {
      lastFedDate.value = ''
      localStorage.removeItem('cs_valley_last_fed_date') 
      
      if (catState.value === 'play') {
        setCatState('sleep', '🐱 昨天玩累了，睡觉中...')
      }
    }
  }, 60000)

  // 🌟 挂载 30 秒自动同步定时器
  autoSyncTimer = setInterval(processAutoSync, AUTO_SYNC_INTERVAL_MS)
  processAutoSync()
})

onUnmounted(() => {
  window.removeEventListener('resize', updateUiScale)
  if (offActivityUpdate) {
    offActivityUpdate()
    offActivityUpdate = null
  }
  if (timerId) clearInterval(timerId)
  
  // 🌟 卸载定时器，并在退出前进行最后一次突击同步
  if (autoSyncTimer) clearInterval(autoSyncTimer)
  processAutoSync()

  teardownFloatingListeners()
  stopBaseAnimation()
  stopPeriodicTimer()
  clearActionInterval()
})

</script>

<template>
  <div
    v-if="isAuthGateVisible"
    class="auth-gate"
    style="-webkit-app-region: no-drag;"
  >
    <section class="auth-gate-panel">
      <div class="auth-gate-brand">CodeSprout Valley</div>
      <h1>{{ isRestoringSession ? '正在唤醒云端花园' : '先登录，再开始种植' }}</h1>
      <p>
        {{ isRestoringSession ? '正在确认账号状态，请稍等片刻。' : '代码统计、猫粮和节气档案会绑定到你的云端账号。登录后再开始，数据就不会散落在本地。' }}
      </p>

      <div v-if="!isRestoringSession" class="auth-gate-form">
        <input v-model.trim="authUsername" class="cloud-input auth-gate-input" placeholder="用户名" />
        <input v-model="authPassword" class="cloud-input auth-gate-input" type="password" placeholder="密码（至少 6 位）" />
        <div class="auth-gate-actions">
          <button class="cloud-btn secondary" :disabled="isCloudBusy" @click="handleRegister">注册</button>
          <button class="cloud-btn primary" :disabled="isCloudBusy" @click="handleLogin">登录</button>
        </div>
      </div>

      <div class="cloud-status auth-gate-status">{{ authStatusMessage }}</div>
    </section>
  </div>

  <div v-else class="authenticated-shell">
  <!-- 第一层：设置面板（背景遮罩 + 设置面板） -->
  <div
    v-if="isSettingsPanelOpen && !isFloatingMode"
    class="settings-mask"
    style="-webkit-app-region: no-drag;"
    @click.self="closeSettings"
  >
    <div class="settings-panel" style="-webkit-app-region: no-drag;">
      <div class="settings-panel-header">
        <h2>设置</h2>
        <button class="settings-panel-close" @click="closeSettings">×</button>
      </div>

      <div class="settings-panel-content">
        <button class="settings-menu-item" @click="openCloudAccountPanel">
          <span class="settings-menu-icon">☁️</span>
          <span class="settings-menu-label">云端账号</span>
          <span class="settings-menu-arrow">→</span>
        </button>
        <button class="settings-menu-item" @click="openUserProfilePanel">
          <span class="settings-menu-icon">👤</span>
          <span class="settings-menu-label">个人资料</span>
          <span class="settings-menu-arrow">→</span>
        </button>
      </div>
    </div>
  </div>

  <!-- 第二层：云端账号面板 -->
  <div
    v-if="isCloudAccountPanelOpen && !isFloatingMode"
    class="cloud-account-mask"
    style="-webkit-app-region: no-drag;"
    @click.self="closeCloudAccountPanel"
  >
    <div class="cloud-account-panel" style="-webkit-app-region: no-drag;">
      <div class="cloud-account-header">
        <button class="cloud-account-back" @click="closeCloudAccountPanel">← 返回</button>
        <h2>云端账号</h2>
        <div style="width: 40px;"></div>
      </div>

      <div class="cloud-account-content">
        <div v-if="loggedInUser" class="cloud-user-card">
          <div class="cloud-user-name">{{ loggedInUser }}</div>
          <div class="cloud-user-meta">{{ lastSyncTime ? `最近同步：${lastSyncTime}` : '' }}</div>
          <div class="cloud-user-meta">自动同步已开启，每 30 秒保存一次云端进度</div>
          <div class="cloud-actions">
            <button class="cloud-btn danger" :disabled="isCloudBusy" @click="handleLogout">退出</button>
          </div>
        </div>

        <div v-else class="cloud-login-form">
          <input v-model.trim="authUsername" class="cloud-input" placeholder="用户名" />
          <input v-model="authPassword" class="cloud-input" type="password" placeholder="密码（至少 6 位）" />
          <div class="cloud-actions">
            <button class="cloud-btn secondary" :disabled="isCloudBusy" @click="handleRegister">注册</button>
            <button class="cloud-btn primary" :disabled="isCloudBusy" @click="handleLogin">登录</button>
          </div>
        </div>

        <div class="cloud-status">{{ authStatusMessage }}</div>
      </div>
    </div>
  </div>

  <!-- 第二层：个人资料面板 -->
  <div
    v-if="isUserProfilePanelOpen && !isFloatingMode"
    class="user-profile-mask"
    style="-webkit-app-region: no-drag;"
    @click.self="closeUserProfilePanel"
  >
    <div class="user-profile-panel" style="-webkit-app-region: no-drag;">
      <div class="user-profile-header">
        <button class="user-profile-back" @click="closeUserProfilePanel">← 返回</button>
        <h2>个人资料</h2>
        <div style="width: 40px;"></div>
      </div>

      <div class="user-profile-content">
        <div class="profile-form">
          <div class="profile-field">
            <label class="profile-label">昵称</label>
            <input v-model.trim="userNickname" class="profile-input" type="text" placeholder="请输入你的昵称" maxlength="20" />
            <span class="profile-hint">{{ userNickname.length }}/20</span>
          </div>

          <div class="profile-field">
            <label class="profile-label">生日</label>
            <input v-model="userBirthday" class="profile-input" type="date" />
            <span class="profile-hint" v-if="userBirthday">{{ userBirthday }}</span>
          </div>

          <div class="profile-actions">
            <button class="profile-btn cancel" @click="closeUserProfilePanel">取消</button>
            <button class="profile-btn save" :disabled="isCloudBusy" @click="saveUserProfile">保存</button>
          </div>
        </div>
      </div>
    </div>
  </div>

  <div class="viewport-root" :class="{ 'floating-root': isFloatingMode }" :style="{ backgroundImage: `url(${currentBgUrl})` }">
    <WeatherEffect v-show="!isFloatingMode" :type="currentWeatherType" />
    <div 
      class="pet-container"
      :class="{ 'floating-mode': isFloatingMode }"

      :style="isFloatingMode ? {} : { transform: `translate(-50%, -50%) scale(${uiScale})` }"
    >
      <div
        v-show="!isFloatingMode"
        class="stats-box"
        :class="{ collapsed: !isStatsVisible }"
        style="-webkit-app-region: no-drag;"
      >
        <div class="stats-header" @click="toggleStats">
          <span class="stats-title">实时状态</span>
          <span class="toggle-arrow">{{ isStatsVisible ? '▲' : '▼' }}</span>
        </div>
        <div class="stats-content">
          <div class="stat-item">
            <span>代码行数: {{ codeLines }}</span>
            <div class="progress-bar">
              <div v-for="i in 5" :key="i" class="grid" :class="{ active: i <= activeGridCount }"></div>
            </div>
          </div>
          <div class="stat-detail">
            <p>🍖 今日喂食: {{ feedCount }} 次</p>
            <p>💧 今日浇水: {{ waterCount }} 次</p>
            <p>✅ 今日通过: {{ todayPassed }} 个</p>
            <p>⚠️ 今日报错: {{ todayErrors }} 个</p>
            <p>🧺 剩余猫粮: {{ foodStock }}</p>
            <p>🚿 剩余水量: {{ waterStock }}</p>
          </div>
        </div>
      </div>

      <div v-show="!isFloatingMode" class="status-bar">
        <h3> {{ currentDate }} · {{ currentSolarTerm }}</h3>
      </div>

      <div class="pet-area" style="-webkit-app-region: no-drag;">
        <div v-if="!isFloatingMode" class="bubble" :class="{ 'bubble-shake': isBubbleShaking }" :style="{ top: bubbleTop, zIndex: 5 }" @click.stop="shakeBubble" @dblclick.stop="handleRestore">{{ message }}</div>
        
        <div class="characters">
          <img
            class="cat-image"
            :class="{
              'cat-idle': catState === 'sleep',
              'cat-eating': catState === 'eating',
              'cat-happy': catState === 'happy',
              'cat-refused': catState === 'refused',
              'cat-playing': catState === 'play',
              'cat-stretching': catState === 'stretching',
              'cat-jumping': catState === 'jumping',
              'cat-lifted': catState === 'lifted'
            }"
            :src="currentCatImage"
            draggable="false"
            @click="interactWithCat"
            @mousedown="onCatMouseDown"
            @mousemove="onCatMouseMove"
            @mouseup="onCatMouseUp"
            @mouseleave="onCatMouseUp"
            :style="isFloatingMode ? 'pointer-events: auto;' : ''"
          />

          <img
            v-show="!isFloatingMode"
            class="plant-image"
            :src="currentPlant.src"
            :style="currentPlant.style"
          />
        </div>
      </div>

      <div v-show="!isFloatingMode" class="action-panel" style="-webkit-app-region: no-drag;">
        <button class="image-btn" @click="feedCat" aria-label="喂猫粮"><img src="./assets/btn-feed.png" draggable="false"></button>
        <button class="image-btn" @click="waterPlant" aria-label="浇水"><img src="./assets/btn-water.png" draggable="false"></button>
        <button class="image-btn image-btn-archive" :class="{ glowing: hasNewHarvest || hasNewReport }" @click="openArchive" aria-label="节气档案"><img src="./assets/btn-gallery.png" draggable="false"></button>
        <button class="image-btn image-btn-settings" @click="openSettings" aria-label="设置"><img src="./assets/btn-settings.png" draggable="false"></button>
        <button class="image-btn" @click="openTimeMachine" aria-label="沙盘模式"><img src="./assets/btn_shapanmode.png" draggable="false"></button>
        <button class="image-btn" @click="resetToday" aria-label="重置今日"><img src="./assets/btn-reset.png" draggable="false"></button>
      </div>

      <div
        v-if="isArchiveOpen && !isFloatingMode"
        class="archive-mask"
        style="-webkit-app-region: no-drag;"
        @click.self="closeArchive"
      >
        <section class="archive-book-panel">
          <div class="archive-book-header">
            <div>
              <span class="archive-book-kicker">CodeSprout Valley</span>
              <h2>节气档案</h2>
            </div>
            <button class="archive-close" @click="closeArchive">×</button>
          </div>
          <div class="archive-book-body">
            <div class="archive-left-page">
              <div class="archive-grid">
                <button
                  v-for="cell in archiveCells"
                  :key="cell.key"
                  class="archive-cell"
                  :class="{ selected: cell.isSelected }"
                  @click="selectArchiveTerm(cell.key)"
                >
                  <img
                    class="archive-cell-img"
                    :src="getArchiveCellImage(cell.key, cell.hasRecord)"
                    :alt="cell.name"
                    draggable="false"
                  />
                </button>
              </div>
            </div>

            <aside class="archive-detail-page">
              <div class="archive-detail-line"></div>
              <h3>{{ selectedArchiveTerm ? selectedArchiveTerm.name : '节气' }}</h3>
              <p class="archive-status-copy">
                <span v-if="selectedArchiveHarvestRecord && selectedArchiveReportRecord">图鉴收获与节气报告已归档</span>
                <span v-else-if="selectedArchiveHarvestRecord">已收获果实，暂未生成节气报告</span>
                <span v-else-if="selectedArchiveReportRecord">已有节气报告，收获果实后会点亮图鉴</span>
                <span v-else-if="selectedArchiveIsCurrentTerm">这个节气还在生长中</span>
                <span v-else>这段节气旅程还没有留下收获</span>
              </p>

              <div class="archive-detail-scroll">
                <section class="archive-section archive-harvest-section">
                  <h4>图鉴收获</h4>
                  <div
                    class="archive-picture-frame harvest-picture-frame"
                    :class="{ clickable: selectedArchiveHarvestRecord }"
                    :role="selectedArchiveHarvestRecord ? 'button' : undefined"
                    :tabindex="selectedArchiveHarvestRecord ? 0 : undefined"
                    @click="selectedArchiveHarvestRecord && openImagePreview(selectedArchiveHarvestRecord.image, selectedArchiveTerm ? `${selectedArchiveTerm.name}${selectedArchiveHarvestRecord.itemName}` : selectedArchiveHarvestRecord.itemName)"
                    @keydown.enter="selectedArchiveHarvestRecord && openImagePreview(selectedArchiveHarvestRecord.image, selectedArchiveTerm ? `${selectedArchiveTerm.name}${selectedArchiveHarvestRecord.itemName}` : selectedArchiveHarvestRecord.itemName)"
                    @keydown.space.prevent="selectedArchiveHarvestRecord && openImagePreview(selectedArchiveHarvestRecord.image, selectedArchiveTerm ? `${selectedArchiveTerm.name}${selectedArchiveHarvestRecord.itemName}` : selectedArchiveHarvestRecord.itemName)"
                  >
                    <span class="archive-tape" aria-hidden="true"></span>
                    <img
                      v-if="selectedArchiveHarvestRecord"
                      class="harvest-detail-img"
                      :src="selectedArchiveHarvestRecord.image"
                      draggable="false"
                    />
                    <span v-else class="archive-picture-placeholder">暂无收获</span>
                  </div>
                  <p v-if="selectedArchiveHarvestRecord" class="harvest-detail-term">
                    第 {{ selectedArchiveHarvestRecord.stage }} 阶段 · {{ selectedArchiveHarvestRecord.itemName }}
                  </p>
                  <p v-if="selectedArchiveHarvestRecord" class="harvest-detail-copy">{{ selectedArchiveHarvestRecord.message }}</p>
                  <p v-else-if="selectedArchiveReportRecord" class="archive-empty-copy">这个节气已有报告记录；等收获果实后，图鉴会正式点亮。</p>
                  <p v-else-if="selectedArchiveIsCurrentTerm" class="archive-empty-copy">这个节气还在生长中，完成一次节气结算并收获果实后，果实会来到这里。</p>
                  <p v-else class="archive-empty-copy">这段节气旅程还没有留下收获，等未来经历并结算后，档案会在这里展开。</p>
                </section>

                <section class="archive-section archive-report-section">
                  <h4>节气报告</h4>
                  <p class="term-report-paper-date">
                    {{ selectedArchiveReportRecord ? selectedArchiveReportRecord.date : '等待结算' }}
                  </p>
                  <p v-if="selectedArchiveReportRecord" class="term-report-paper-summary">
                    {{ selectedArchiveReportRecord.summary }}
                  </p>
                  <div v-else class="archive-empty-action" style="margin-top: 15px;">
                    <p class="archive-empty-copy">暂无节气报告。</p>
                    
                    <button v-if="cloudToken && selectedArchiveTerm" class="cloud-btn primary" style="width: 100%; margin-top: 10px; padding: 12px; font-weight: bold; background: #4f8f5f;" @click="generateAndSaveCloudReport">
                      📊 生成【{{ selectedArchiveTerm.name }}】节气报告
                    </button>
                    
                    <p v-if="selectedArchiveIsCurrentTerm" class="archive-empty-copy" style="font-size: 12px; color: #8a7658; margin-top: 5px;">
                      (当前节气还在生长中，还未生成节气报告)
                    </p>

                    <p v-else-if="!cloudToken" class="archive-empty-copy" style="font-size: 12px; color: #8a7658; margin-top: 5px;">
                      (请先登录以生成云端报告)
                    </p>

                    <p v-else-if="selectedArchiveIsEndedForReport" class="archive-empty-copy" style="font-size: 12px; color: #8a7658; margin-top: 5px;">
                      (该节气已结束，可手动生成云端报告)
                    </p>

                    <p v-else class="archive-empty-copy" style="font-size: 12px; color: #8a7658; margin-top: 5px;">
                      (该节气还未进入结算时间)
                    </p>
                  </div>
                  <div
                    class="term-report-chart-placeholder archive-picture-frame"
                    :class="{ clickable: selectedArchiveSolarTermImage }"
                    :role="selectedArchiveSolarTermImage ? 'button' : undefined"
                    :tabindex="selectedArchiveSolarTermImage ? 0 : undefined"
                    @click="openImagePreview(selectedArchiveSolarTermImage, selectedArchiveTerm ? `${selectedArchiveTerm.name}节气图` : '节气图')"
                    @keydown.enter="openImagePreview(selectedArchiveSolarTermImage, selectedArchiveTerm ? `${selectedArchiveTerm.name}节气图` : '节气图')"
                    @keydown.space.prevent="openImagePreview(selectedArchiveSolarTermImage, selectedArchiveTerm ? `${selectedArchiveTerm.name}节气图` : '节气图')"
                  >
                    <span class="archive-tape" aria-hidden="true"></span>
                    <img
                      v-if="selectedArchiveSolarTermImage"
                      class="term-report-image"
                      :src="selectedArchiveSolarTermImage"
                      :alt="selectedArchiveTerm ? `${selectedArchiveTerm.name}节气图` : '节气图'"
                      draggable="false"
                    />
                    <span v-else>暂无节气图</span>
                  </div>

                  <div v-if="selectedArchiveReportRecord" class="term-report-data-grid">
                    <div class="term-report-data-item"><span>累计代码</span><strong>{{ selectedArchiveReportRecord.totalCodeLines }}</strong></div>
                    <div class="term-report-data-item"><span>通过率</span><strong>{{ selectedArchiveReportRecord.passRate }}</strong></div>
                    <div class="term-report-data-item"><span>通过/提交</span><strong>{{ selectedArchiveReportRecord.todayPassed }}</strong></div>
                    <div class="term-report-data-item"><span>报错次数</span><strong>{{ selectedArchiveReportRecord.todayErrors }}</strong></div>
                    <div class="term-report-data-item"><span>照料次数</span><strong>{{ selectedArchiveReportRecord.totalActions }}</strong></div>
                    <div class="term-report-data-item"><span>植物阶段</span><strong>{{ selectedArchiveReportRecord.plantStage }}</strong></div>
                  </div>

                  <div v-if="selectedArchiveReportRecord" class="term-report-paper-footer">
                    <span>{{ selectedArchiveReportRecord.owner }}</span><span>{{ selectedArchiveReportRecord.syncText }}</span>
                  </div>
                </section>
              </div>
            </aside>
          </div>
        </section>

        <div
          v-if="previewImage"
          class="image-preview-mask"
          style="-webkit-app-region: no-drag;"
          @click.self.stop="closeImagePreview"
        >
          <button class="image-preview-close" @click="closeImagePreview">×</button>
          <img
            class="image-preview-img"
            :src="previewImage.src"
            :alt="previewImage.alt"
            draggable="false"
          />
        </div>
      </div>

      <div
        v-if="isTimeMachineOpen && !isFloatingMode"
        class="time-machine-mask"
        style="-webkit-app-region: no-drag;"
        @click.self="closeTimeMachine"
      >
        <div class="time-machine-panel" style="-webkit-app-region: no-drag;">
          <div class="time-machine-title">沙盘模式</div>
          <div class="time-machine-inputs">
            <input ref="tmYearInputEl" v-model.trim="tmYear" class="time-machine-input" inputmode="numeric" maxlength="4" placeholder="YYYY" @input="timeMachineError = ''" />
            <span class="time-machine-unit">年</span>
            <input v-model.trim="tmMonth" class="time-machine-input" inputmode="numeric" maxlength="2" placeholder="MM" @input="timeMachineError = ''" />
            <span class="time-machine-unit">月</span>
            <input v-model.trim="tmDay" class="time-machine-input" inputmode="numeric" maxlength="2" placeholder="DD" @input="timeMachineError = ''" />
            <span class="time-machine-unit">日</span>
          </div>
          <div class="settlement-stage-row">
            <span>结算档位</span>
            <select v-model.number="tmSettlementStage" class="settlement-stage-select" @change="timeMachineError = ''">
              <option :value="1">代码阶段 1 · 初始积累</option>
              <option :value="2">代码阶段 2 · 稳定发芽</option>
              <option :value="3">代码阶段 3 · 代码量不错</option>
              <option :value="4">代码阶段 4 · 代码量超群</option>
            </select>
          </div>
          <div v-if="timeMachineError" class="time-machine-error">{{ timeMachineError }}</div>
          <div class="time-machine-actions">
            <button class="time-machine-btn" @click="applyTimeMachine">确认应用</button>
            <button class="time-machine-btn primary" @click="simulateTermSettlement">模拟结算</button>
            <button class="time-machine-btn" @click="closeTimeMachine">取消</button>
            <button v-if="isSandboxActive" class="time-machine-btn danger" @click="exitTimeMachine">退出沙盘</button>
          </div>
        </div>
      </div>

    </div>
  </div>
  </div>
</template>

<style scoped>
/* 原有的基础与布局样式 */
.authenticated-shell {
  width: 100vw;
  height: 100vh;
}

.auth-gate {
  width: 100vw;
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  box-sizing: border-box;
  color: #334331;
  background:
    linear-gradient(180deg, rgba(250, 252, 242, 0.78), rgba(229, 244, 224, 0.88)),
    url('./assets/background.png') center / cover no-repeat;
  font-family: "Microsoft YaHei", sans-serif;
}

.auth-gate-panel {
  width: min(440px, 92vw);
  padding: 30px;
  box-sizing: border-box;
  border: 2px solid rgba(87, 124, 87, 0.32);
  border-radius: 16px;
  background: rgba(250, 252, 242, 0.96);
  box-shadow: 0 18px 46px rgba(54, 73, 48, 0.24);
}

.auth-gate-brand {
  margin-bottom: 8px;
  color: #5f7d4d;
  font-size: 13px;
  font-weight: 700;
}

.auth-gate-panel h1 {
  margin: 0 0 10px;
  color: #315c3b;
  font-size: 28px;
  line-height: 1.25;
}

.auth-gate-panel p {
  margin: 0 0 20px;
  color: #596a50;
  font-size: 14px;
  line-height: 1.7;
}

.auth-gate-form {
  display: grid;
  gap: 10px;
}

.auth-gate-input {
  min-height: 40px;
  font-size: 14px;
}

.auth-gate-actions {
  display: flex;
  gap: 10px;
}

.auth-gate-status {
  margin-top: 14px;
}

.viewport-root {
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  position: relative;
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
}

.viewport-root.floating-root {
  background: transparent !important;
  background-image: none !important;
}

.cloud-panel {
  position: absolute;
  top: 24px;
  left: 24px;
  z-index: 9999;
  width: 270px;
  padding: 14px;
  color: #3f4a38;
  background: rgba(250, 252, 242, 0.94);
  border: 1px solid rgba(87, 124, 87, 0.28);
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(45, 58, 39, 0.18);
  font-family: "Microsoft YaHei", sans-serif;
}

.cloud-panel-title { margin-bottom: 10px; color: #3f6d4a; font-size: 16px; }
.cloud-login-form, .cloud-user-card { display: grid; gap: 8px; }
.cloud-input { width: 100%; box-sizing: border-box; padding: 8px 10px; border: 1px solid rgba(88, 117, 93, 0.38); border-radius: 6px; color: #344235; background: rgba(255, 255, 255, 0.86); outline: none; }
.cloud-user-name { font-size: 15px; color: #2f5d3a; }
.cloud-user-meta { min-height: 16px; color: #6b7568; font-size: 12px; }
.cloud-actions { display: flex; gap: 8px; }
.cloud-btn { flex: 1; padding: 8px 10px; border: 0; border-radius: 6px; color: white; cursor: pointer; }
.cloud-btn:disabled { cursor: wait; opacity: 0.6; }
.cloud-btn.primary { background: #4f8f5f; }
.cloud-btn.secondary { background: #5b87b4; }
.cloud-btn.danger { background: #b75b54; }
.cloud-status { margin-top: 10px; padding: 8px; border-left: 3px solid #7ea56d; border-radius: 6px; background: rgba(239, 244, 229, 0.86); color: #4d5a45; font-size: 12px; line-height: 1.4; }

/* ========== 设置面板样式 ========== */
.settings-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
}

.settings-panel {
  position: relative;
  width: 400px;
  background: rgba(250, 252, 242, 0.98);
  border: 2px solid rgba(87, 124, 87, 0.35);
  border-radius: 16px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  padding: 0;
  overflow: hidden;
}

.settings-panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid rgba(87, 124, 87, 0.15);
  background: linear-gradient(135deg, rgba(134, 212, 152, 0.1), rgba(141, 200, 157, 0.05));
}

.settings-panel-header h2 {
  margin: 0;
  color: #3f6d4a;
  font-size: 24px;
  font-weight: 600;
}

.settings-panel-close {
  background: none;
  border: none;
  font-size: 28px;
  color: #7b8f4f;
  cursor: pointer;
  padding: 0;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  transition: background 0.2s;
}

.settings-panel-close:hover {
  background: rgba(87, 124, 87, 0.1);
}

.settings-panel-content {
  padding: 16px;
  max-height: 60vh;
  overflow-y: auto;
}

.settings-menu-item {
  width: 100%;
  padding: 16px 18px;
  background: rgba(255, 255, 255, 0.7);
  border: 1px solid rgba(87, 124, 87, 0.2);
  border-radius: 10px;
  display: flex;
  align-items: center;
  gap: 14px;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 16px;
  color: #3f4a38;
  margin-bottom: 10px;
}

.settings-menu-item:hover {
  background: rgba(134, 212, 152, 0.15);
  border-color: rgba(87, 124, 87, 0.3);
  transform: translateX(4px);
}

.settings-menu-icon {
  font-size: 20px;
  width: 28px;
  text-align: center;
}

.settings-menu-label {
  flex: 1;
  text-align: left;
  font-weight: 500;
}

.settings-menu-arrow {
  color: #7b8f4f;
  font-size: 18px;
}

/* ========== 云端账号面板样式 ========== */
.cloud-account-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10001;
}

.cloud-account-panel {
  position: relative;
  width: 450px;
  max-height: 70vh;
  background: rgba(250, 252, 242, 0.98);
  border: 2px solid rgba(87, 124, 87, 0.35);
  border-radius: 16px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  padding: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.cloud-account-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid rgba(87, 124, 87, 0.15);
  background: linear-gradient(135deg, rgba(134, 212, 152, 0.1), rgba(141, 200, 157, 0.05));
}

.cloud-account-header h2 {
  margin: 0;
  color: #3f6d4a;
  font-size: 22px;
  font-weight: 600;
  flex: 1;
  text-align: center;
}

.cloud-account-back {
  background: none;
  border: none;
  color: #4f8f5f;
  cursor: pointer;
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 14px;
  transition: background 0.2s;
}

.cloud-account-back:hover {
  background: rgba(87, 124, 87, 0.15);
}

.cloud-account-content {
  flex: 1;
  padding: 20px;
  overflow-y: auto;
}

/* ========== 个人资料面板样式 ========== */
.user-profile-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10001;
}

.user-profile-panel {
  position: relative;
  width: 450px;
  max-height: 70vh;
  background: rgba(250, 252, 242, 0.98);
  border: 2px solid rgba(87, 124, 87, 0.35);
  border-radius: 16px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  padding: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.user-profile-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid rgba(87, 124, 87, 0.15);
  background: linear-gradient(135deg, rgba(134, 212, 152, 0.1), rgba(141, 200, 157, 0.05));
}

.user-profile-header h2 {
  margin: 0;
  color: #3f6d4a;
  font-size: 22px;
  font-weight: 600;
  flex: 1;
  text-align: center;
}

.user-profile-back {
  background: none;
  border: none;
  color: #4f8f5f;
  cursor: pointer;
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 14px;
  transition: background 0.2s;
}

.user-profile-back:hover {
  background: rgba(87, 124, 87, 0.15);
}

.user-profile-content {
  flex: 1;
  padding: 24px;
  overflow-y: auto;
}

.profile-form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.profile-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.profile-label {
  color: #3f6d4a;
  font-size: 14px;
  font-weight: 600;
}

.profile-input {
  width: 100%;
  box-sizing: border-box;
  padding: 10px 12px;
  border: 1px solid rgba(87, 124, 87, 0.3);
  border-radius: 8px;
  color: #344235;
  background: rgba(255, 255, 255, 0.9);
  font-size: 14px;
  outline: none;
  transition: border-color 0.2s, background 0.2s;
}

.profile-input:focus {
  border-color: rgba(79, 143, 95, 0.6);
  background: rgba(255, 255, 255, 1);
}

.profile-hint {
  font-size: 12px;
  color: #8a7658;
}

.profile-actions {
  display: flex;
  gap: 12px;
  margin-top: 12px;
}

.profile-btn {
  flex: 1;
  padding: 12px 16px;
  border: 1px solid rgba(87, 124, 87, 0.3);
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
  font-weight: 500;
}

.profile-btn.cancel {
  background: rgba(255, 255, 255, 0.8);
  color: #5a4630;
}

.profile-btn.cancel:hover {
  background: rgba(255, 255, 255, 1);
  border-color: rgba(87, 124, 87, 0.5);
}

.profile-btn.save {
  background: #4f8f5f;
  color: white;
  border-color: #4f8f5f;
}

.profile-btn.save:hover {
  background: #3f6f4a;
  border-color: #3f6f4a;
}

.pet-container {
  --ui-bg: rgba(134, 212, 152, 0.88);
  --ui-bg-hover: rgba(141, 200, 157, 0.93);
  --ui-border: #879e94;
  --ui-shadow: #768a81;
  --ui-text: #f6f3ea;
  width: 1365px;
  height: 768px;
  position: absolute;
  top: 50%;
  left: 50%;
  display: flex;
  flex-direction: column;
  align-items: center;
  color: white;
  border-radius: 20px;
  font-family: "华文中宋", "Microsoft YaHei", "黑体", sans-serif;
  font-size: 15px;
  transform-origin: center center;
}

.pet-container,
.pet-container * {
  font-weight: 900;
}

.pet-container.floating-mode .cat-image:hover {
  transform: none !important;
}
.pet-container.floating-mode .cat-image {
  width: 170px !important;
  height: 170px !important;
  position: static !important;  /* 改为静态定位，由 .characters 控制位置 */
  transform: none !important;
  left: auto !important;
  bottom: auto !important;
}
.pet-container.floating-mode {
  position: relative;
  top: 0;
  left: 0;
  width: 350px !important;   /* 固定宽度，与窗口窗口参数一致 */
  height: 400px !important;  /* 固定高度，与窗口一致 */
  background: transparent !important;
  background-image: none !important;
  overflow: visible;
  display: flex;             /* 保持 flex，但需要调整子元素 */
  flex-direction: column;
  align-items: center;
  padding: 0;                /* 去除内边距，避免偏移 */
  border-radius: 0;
  transform: none !important;
}

.pet-container.floating-mode .characters {
  left: 50% !important;
  top: 50% !important;
  transform: translate(-50%, -50%) !important;
  width: auto !important;   /* 确保不固定宽度 */
  height: auto !important;
  z-index: 1 !important;           
}

.pet-container.floating-mode .pet-area {
  position: relative;
  width: 100%;
  height: 100%;
  flex: 1;
}

.stats-box {
  position: absolute;
  top: 30px;
  left: 78%;
  transform: translateX(-50%);
  width: 310px;
  height: 400px;
  overflow: visible;
  transition:
    width 0.3s ease,
    height 0.3s ease,
    top 0.3s ease,
    left 0.3s ease,
    transform 0.3s ease;
  background-image: url('./assets/stats-expanded.png');
  background-repeat: no-repeat;
  background-position: center;
  background-size: 100% 100%;
  border: none;
  box-shadow: none;
  z-index: 4;
}

.stats-box::before {
  content: '';
  position: absolute;
  width: 0;
  height: 0;
  overflow: hidden;
  background-image: url('./assets/stats-expanded.png'), url('./assets/stats-collapsed.png');
  pointer-events: none;
}

.stats-header {
  position: absolute;
  top: 1px;
  left: 93px;
  right: 56px;
  height: 78px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
  transition: opacity 0.2s ease;
  z-index: 5;
}

.stats-title {
  font-size: 25px;
  font-weight: 400;
  color: #f3efe5;
  letter-spacing: 1px;
  text-shadow: 0 2px 3px rgba(40, 32, 18, 0.3);
}

.toggle-arrow {
  font-size: 22px;
  color: #f3efe5;
  text-shadow: 0 2px 3px rgba(40, 32, 18, 0.3);
}

.stats-box.collapsed {
  background-image: url('./assets/stats-collapsed.png') !important;
  background-color: transparent;
  background-repeat: no-repeat;
  background-position: center;
  background-size: contain; 
  overflow: visible; 
  width: 255px;   
  height: 140px;  
  top: 12px;      
  left: 920px;    
  transform: none;
  box-shadow: none;
}

.stats-box.collapsed .stats-header {
  position: absolute;
  inset: 0; 
  width: 100%;
  height: 100%;
  opacity: 0; 
  pointer-events: auto; 
}

.stats-box.collapsed .stats-title,
.stats-box.collapsed .toggle-arrow {
  display: none;
}

.stats-content {
  position: absolute;
  top: 87px;
  left: 48px;
  right: 60px;
  bottom: 76px;
  padding: 0;
  color: #4a3f2f;
  opacity: 1;
  visibility: visible;
  transition:
    opacity 0.16s ease 0.18s,
    visibility 0s linear 0.18s;
  pointer-events: auto;
}

.stats-box.collapsed .stats-content {
  opacity: 0;
  visibility: hidden;
  transition-delay: 0s;
  pointer-events: none;
}

.progress-bar {
  display: flex;
  gap: 4px;
  margin-top: 2px;
  height: 25px;
  padding: 3px;
  border: 2px solid rgba(44, 94, 44, 0.62);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.65);
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.08);
  width: 200px;
}
.grid {
  flex: 1;
  background: rgba(44, 94, 44, 0.16);
  border-radius: 8px;
}
.grid.active {
  background: #4CAF50;
  box-shadow: 0 0 5px #4CAF50;
}
.stat-detail p {
  margin: 3px 0 0 0;
  font-size: 18px;
  color: #4a3f2f;
}
.stat-item span{
  color: #4a3f2f;
  font-size: 18px;
}

.status-bar {
  position: absolute;
  top: 22px;
  left: 520px;
  width: 420px;
  height: 96px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  background-image: url('./assets/date-banner.png');
  background-repeat: no-repeat;
  background-position: center;
  background-size: 100% 100%;
  padding: 0 36px;
  border: none;
  box-shadow: none;
  z-index: 3;
}

.status-bar h3 {
  margin: 0;
  color: #6a5138;
  font-size: 21px;
  font-weight: 900;
  letter-spacing: 2px;
  line-height: 1;
  white-space: nowrap;
  text-shadow: none;
  transform: translateY(-4px);
}

.pet-area {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 1;
}

.bubble {
  position: absolute;
  left: 43%;
  white-space: nowrap;
  background: url('./assets/speech_bubble.png') no-repeat center;
  background-size: 100% 100%;
  color: #333;
  padding: 35px 45px 25px;
  font-weight: bold;
  font-size: 14px;
  pointer-events: auto;
  cursor: pointer;
  transform: translate(-50%, calc(-50% - 60px)) scale(1.5);
}

.bubble-shake {
  animation: bubbleShake 0.35s ease-in-out;
}

@keyframes bubbleShake {
  0%, 100% { transform: translate(-50%, calc(-50% - 60px)) scale(1.5); }
  20% { transform: translate(calc(-50% - 6px), calc(-50% - 60px)) scale(1.5); }
  40% { transform: translate(calc(-50% + 6px), calc(-50% - 60px)) scale(1.5); }
  60% { transform: translate(calc(-50% - 4px), calc(-50% - 60px)) scale(1.5); }
  80% { transform: translate(calc(-50% + 4px), calc(-50% - 60px)) scale(1.5); }
}

.characters {
  position: absolute;
  left: 43%;
  top: 78%;
  transform: translate(-50%, -50%);
  width: 300px;
  height: 300px;
  pointer-events: auto;
}

.cat-image {
  position: absolute;
  left: -15px;
  bottom: 95px;
  width: 250px;
  height: 250px;
  display: block;
  object-fit: contain;
  object-position: center bottom;
  filter: drop-shadow(0px 10px 10px rgba(0,0,0,0.5));
  transition: transform 0.2s;
  transform-origin: bottom center;
  cursor: grab;
  will-change: transform; 
}

.cat-idle {
  position: absolute;
  left: 25px;
  bottom: 55px;
  width: 170px;
  height: 170px;
  display: block;
  object-fit: contain;
  object-position: center bottom;
  filter: drop-shadow(0px 10px 10px rgba(0,0,0,0.5));
  transition: transform 0.2s;
  transform-origin: bottom center;
  cursor: grab;
  will-change: transform;
}

.cat-stretching,
.cat-jumping {
  position: absolute;
  left: 25px;
  bottom: 75px;
  width: 170px;
  height: 170px;
  display: block;
  object-fit: contain;
  object-position: center bottom;
  filter: drop-shadow(0px 10px 10px rgba(0,0,0,0.5));
  transition: transform 0.2s;
  transform: scale(1.1);
  transform-origin: bottom center;
  cursor: grab;
  will-change: transform;
}

.cat-image:active {
  cursor: grabbing;
}

.cat-idle:hover {
  transform: scale(1.05); /* 因为已经是真实图片，hover放大倍数稍微减小以免失真 */
}

.plant-image {
  position: absolute;
  left: 200px;
  bottom: 0px;
  width: 95px;
  transform: scale(5);
  transform-origin: bottom center;
}

.action-panel {
  position: absolute; 
  top: 30px;
  right: 20px;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 10px;
  z-index: 4;
}

.image-btn {
  width: 150px;
  padding: 0;
  border: none;
  background: transparent;
  line-height: 0;
  cursor: pointer;
  transition: transform 0.12s ease, filter 0.12s ease;
}

.image-btn img {
  width: 100%;
  height: auto;
  display: block;
  user-select: none;
  pointer-events: none;
}

.image-btn:hover {
  filter: brightness(1.04);
  transform: translateY(-1px);
}

.image-btn:active {
  filter: brightness(0.98);
  transform: translateY(2px);
}

.image-btn-archive.glowing {
  animation: galleryButtonGlow 1.25s ease-in-out infinite;
  filter: drop-shadow(0 0 10px rgba(255, 210, 74, 0.95));
}

.archive-mask {
  position: absolute;
  inset: 0;
  z-index: 13;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(58, 45, 29, 0.28);
  pointer-events: auto;
}

.archive-book-panel {
  --archive-height: 80vh;
  position: relative;
  width: 1000px;
  height: var(--archive-height);
  max-height: 820px;
  padding: 18px 20px 20px;
  border: 3px solid #b2aca0;
  border-radius: 18px 32px 22px 18px;
  background:
    linear-gradient(90deg, rgba(185, 213, 161, 0.22), transparent 13%, transparent 87%, rgba(237, 174, 92, 0.16)),
    linear-gradient(92deg, #f7f0df 0%, #efe5cf 49%, #d8d1c3 50%, #f6eddc 51%, #f1e4cc 100%);
  color: #4e3823;
  box-shadow: 0 20px 44px rgba(62, 47, 28, 0.3), inset 0 0 0 8px rgba(255, 255, 255, 0.28);
}

.archive-book-panel::before {
  content: "";
  position: absolute;
  top: 10%;
  bottom: 10%;
  left: 50%;
  width: 10px;
  border-radius: 999px;
  background: linear-gradient(90deg, rgba(145, 137, 123, 0.16), rgba(255, 255, 255, 0.46), rgba(118, 108, 94, 0.2));
  transform: translateX(-50%);
  pointer-events: none;
}

.archive-book-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 12px;
  padding: 0 4px 0 10px;
}

.archive-book-kicker {
  display: block;
  color: #7f9b58;
  font-size: 11px;
  letter-spacing: 0;
  line-height: 1;
}

.archive-book-header h2 {
  margin: 3px 0 0;
  color: #4d3a26;
  font-family: "华文中宋", KaiTi, STKaiti, serif;
  font-size: 26px;
  line-height: 1.1;
  text-shadow: 0 1px 0 rgba(255, 255, 255, 0.7);
}

.archive-close {
  width: 32px;
  height: 32px;
  border: 1px solid rgba(134, 99, 58, 0.26);
  border-radius: 50%;
  color: #6e5638;
  background: rgba(255, 236, 196, 0.72);
  cursor: pointer;
  font-size: 22px;
  line-height: 1;
  box-shadow: 0 3px 0 rgba(150, 112, 65, 0.18);
}

.archive-book-body {
  position: relative;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 30px;
  /* 让左右页区块填满剩余高度 */
  height: calc(100% - 80px);
}

.archive-left-page,
.archive-detail-page {
  position: relative;
  height: 100%;
  min-height: 0;
  padding: 22px 20px;
  border: 1px solid rgba(154, 138, 112, 0.28);
  border-radius: 12px;
  background:
    radial-gradient(circle at 18% 12%, rgba(255, 255, 255, 0.58), transparent 28%),
    linear-gradient(135deg, rgba(255, 249, 230, 0.72), rgba(238, 222, 190, 0.62));
  box-shadow: inset 0 0 20px rgba(169, 143, 95, 0.12);
}

.archive-grid {
  display: grid;
  grid-template-columns: repeat(6, 58px);
  grid-template-rows: repeat(4, 68px);
  justify-content: center;
  gap: 25px 7px;
  margin: 0;
  align-content: center;
}

/* 保证左侧页内的格子在容器中垂直和水平居中 */
.archive-left-page {
  display: flex;
  align-items: center;
  justify-content: center;
}

.archive-cell-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
  pointer-events: none;
}

.archive-cell-img {
  transition: transform 160ms cubic-bezier(.2,.9,.3,1), box-shadow 160ms ease;
  transform-origin: center center;
}

.archive-cell {
  position: relative;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0;
  min-width: 0;
  padding: 0;
  border: none;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
  color: inherit;
  cursor: pointer;
  width: 68px;
  height: 78px;
}

.archive-cell::before { display: none; }

.archive-cell:hover {
  transform: translateY(0);
}

.archive-cell.selected {
  z-index: 3;
}

/* 选中时放大图片并给出凸起投影感 */
.archive-cell.selected .archive-cell-img {
  transform: scale(1.08);
  box-shadow: 0 10px 24px rgba(18, 24, 32, 0.28), inset 0 6px 12px rgba(255,255,255,0.12);
  border-radius: 6px;
}

.archive-term {
  display: none !important;
}

.archive-detail-page {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 24px 30px;
  text-align: center;
  overflow: hidden;
}

.archive-detail-line {
  width: 82%;
  height: 3px;
  margin-bottom: 20px;
  border-radius: 999px;
  background: rgba(153, 143, 128, 0.42);
}

.archive-picture-frame {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 270px;
  min-height: 190px;
  margin: 0 auto 18px;
  border: 5px solid rgba(157, 129, 89, 0.42);
  border-radius: 8px;
  background: #fff0cf;
  box-shadow:
    0 8px 14px rgba(103, 78, 43, 0.2),
    inset 0 0 0 1px rgba(255, 255, 255, 0.72);
}

.archive-status-copy {
  margin: 8px 0 14px;
  color: #7b8f4f;
  font-size: 14px;
}

.archive-detail-scroll {
  width: 100%;
  max-height: 408px;
  overflow-y: auto;
  padding: 16px 10px 4px;
  scrollbar-color: #d89d58 rgba(225, 202, 163, 0.5);
  scrollbar-width: thin;
}

.archive-detail-scroll::-webkit-scrollbar {
  width: 9px;
}

.archive-detail-scroll::-webkit-scrollbar-track {
  border-radius: 999px;
  background: rgba(225, 202, 163, 0.42);
}

.archive-detail-scroll::-webkit-scrollbar-thumb {
  border: 2px solid rgba(246, 235, 211, 0.88);
  border-radius: 999px;
  background: #d89d58;
}

.archive-section {
  position: relative;
  padding: 18px 14px 20px;
  border: 1px solid rgba(150, 124, 82, 0.22);
  border-radius: 10px;
  background: rgba(255, 248, 228, 0.54);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.55);
}

.archive-section + .archive-section {
  margin-top: 16px;
}

.archive-section h4 {
  margin: 0 0 30px;
  color: #5c432b;
  font-family: "华文中宋", KaiTi, STKaiti, serif;
  font-size: 22px;
  line-height: 1.1;
}

.archive-tape {
  position: absolute;
  top: -28px;
  left: 50%;
  width: 38px;
  height: 48px;
  border: 1px solid rgba(151, 119, 74, 0.18);
  border-radius: 2px;
  background: rgba(238, 207, 149, 0.78);
  box-shadow: 0 2px 4px rgba(103, 78, 43, 0.14);
  transform: translateX(-50%) rotate(-3deg);
}

.harvest-detail-img {
  width: 210px;
  height: 210px;
  object-fit: contain;
  filter: drop-shadow(0 8px 8px rgba(89, 51, 22, 0.2));
  user-select: none;
}

.harvest-picture-frame.clickable {
  cursor: zoom-in;
}

.harvest-picture-frame.clickable:hover {
  transform: translateY(-1px);
  box-shadow:
    0 10px 18px rgba(103, 78, 43, 0.24),
    inset 0 0 0 1px rgba(255, 255, 255, 0.72);
}

.archive-picture-placeholder {
  color: rgba(101, 78, 47, 0.48);
  font-family: KaiTi, STKaiti, serif;
  font-size: 22px;
}

.archive-detail-page h3 {
  margin: 0;
  color: #4d3722;
  font-family: "华文中宋", KaiTi, STKaiti, serif;
  font-size: 34px;
  line-height: 1.15;
}

.harvest-detail-term {
  margin: 8px 0 12px;
  color: #7b8f4f;
  font-size: 14px;
}

.harvest-detail-copy,
.archive-empty-copy,
.term-report-paper-summary {
  margin: 0;
  color: #5a4630;
  font-size: 18px;
  line-height: 1.55;
}

.term-report-paper-date {
  margin: 0 0 4px;
  color: #8a7658;
  font-size: 13px;
}

.term-report-chart-placeholder {
  overflow: hidden;
  min-height: 118px;
  margin-top: 18px;
  color: rgba(84, 111, 67, 0.58);
  font-family: KaiTi, STKaiti, serif;
  font-size: 22px;
}

.term-report-chart-placeholder.clickable {
  cursor: zoom-in;
}

.term-report-chart-placeholder.clickable:hover {
  transform: translateY(-1px);
  box-shadow:
    0 10px 18px rgba(103, 78, 43, 0.24),
    inset 0 0 0 1px rgba(255, 255, 255, 0.72);
}

.term-report-image {
  width: 100%;
  height: 190px;
  object-fit: cover;
  border-radius: 3px;
  user-select: none;
}

.image-preview-mask {
  position: absolute;
  inset: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 46px;
  background: rgba(37, 29, 20, 0.76);
  pointer-events: auto;
}

.image-preview-img {
  max-width: min(88vw, 980px);
  max-height: 82vh;
  border: 6px solid rgba(255, 241, 208, 0.82);
  border-radius: 10px;
  object-fit: contain;
  box-shadow: 0 24px 60px rgba(15, 10, 6, 0.52);
  user-select: none;
}

.image-preview-close {
  position: absolute;
  top: 28px;
  right: 30px;
  width: 40px;
  height: 40px;
  border: 1px solid rgba(255, 241, 208, 0.5);
  border-radius: 999px;
  background: rgba(255, 248, 228, 0.92);
  color: #4d3722;
  cursor: pointer;
  font-size: 28px;
  line-height: 1;
}

.term-report-data-grid {
  display: grid;
  width: 100%;
  grid-template-columns: repeat(3, 1fr);
  gap: 9px;
  margin-top: 16px;
}

.term-report-data-item {
  min-height: 66px;
  padding: 9px;
  border: 1px solid rgba(125, 145, 83, 0.24);
  border-radius: 7px;
  background: rgba(243, 247, 218, 0.72);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.5);
}

.term-report-data-item span {
  display: block;
  color: #7c785e;
  font-size: 12px;
}

.term-report-data-item strong {
  display: block;
  margin-top: 7px;
  color: #4d6d3e;
  font-size: 21px;
}

.term-report-paper-footer {
  display: flex;
  width: 100%;
  justify-content: space-between;
  gap: 12px;
  margin-top: 14px;
  padding-top: 14px;
  color: #857458;
  font-size: 12px;
}

.report-mask { position: absolute; inset: 0; z-index: 12; display: flex; align-items: center; justify-content: center; background: rgba(40, 32, 18, 0.28); pointer-events: auto; }
.report-panel { width: 560px; padding: 22px; border: 1px solid rgba(84, 78, 62, 0.4); border-radius: 8px; background: rgba(253, 250, 240, 0.96); color: #4e4230; box-shadow: 0 18px 42px rgba(44, 36, 20, 0.22); }
.report-header { display: flex; justify-content: space-between; gap: 16px; }
.report-header h2 { margin: 3px 0 0; font-size: 24px; color: #3f6d4a; }
.report-date { margin: 0; color: #7a6c55; font-size: 13px; }
.report-close { width: 32px; height: 32px; border: 0; border-radius: 50%; color: #5d4f3c; background: rgba(98, 82, 53, 0.1); cursor: pointer; font-size: 22px; line-height: 1; }
.report-summary { margin: 16px 0; color: #5a513f; line-height: 1.6; }
.report-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
.report-item { min-height: 74px; padding: 12px; border: 1px solid rgba(93, 116, 76, 0.22); border-radius: 8px; background: rgba(244, 247, 232, 0.78); }
.report-item span { display: block; color: #77705f; font-size: 12px; }
.report-item strong { display: block; margin-top: 8px; color: #3d5f42; font-size: 22px; }
.report-footer { display: flex; justify-content: space-between; gap: 12px; margin-top: 16px; color: #756d5c; font-size: 12px; }

.time-machine-mask {
  position: absolute;
  inset: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(40, 32, 18, 0.28);
  pointer-events: auto;
}

.time-machine-panel {
  width: 520px;
  padding: 18px 20px;
  border-radius: 16px;
  border: 1px solid rgba(84, 78, 62, 0.45);
  background: rgba(252, 248, 236, 0.92);
  color: #5a4730;
}

.time-machine-title {
  font-size: 20px;
  margin-bottom: 12px;
}

.time-machine-inputs {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-bottom: 14px;
}

.time-machine-input {
  width: 90px;
  height: 36px;
  border-radius: 10px;
  border: 1px solid rgba(84, 78, 62, 0.45);
  padding: 0 10px;
  font-size: 16px;
  background: rgba(252, 248, 236, 0.98);
  color: #5a4730;
  outline: none;
}

.settlement-stage-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  margin-bottom: 14px;
  color: #5a4730;
  font-size: 14px;
}

.settlement-stage-select {
  width: 210px;
  height: 36px;
  border-radius: 8px;
  border: 1px solid rgba(84, 78, 62, 0.45);
  padding: 0 10px;
  background: rgba(252, 248, 236, 0.98);
  color: #5a4730;
  outline: none;
}

.time-machine-actions {
  flex-wrap: wrap;
  display: flex;
  justify-content: center;
  gap: 10px;
}

.time-machine-error {
  margin: 6px 0 12px;
  text-align: center;
  color: rgba(170, 45, 45, 0.95);
  font-size: 14px;
}

.time-machine-btn {
  height: 34px;
  padding: 0 12px;
  border-radius: 999px;
  border: 1px solid rgba(84, 78, 62, 0.45);
  background: rgba(252, 248, 236, 0.85);
  color: #5a4730;
  cursor: pointer;
  transition: transform 0.12s ease, background-color 0.12s ease;
}

.time-machine-btn:hover {
  background: rgba(252, 248, 236, 0.98);
  transform: translateY(-1px);
}

.time-machine-btn:active {
  transform: translateY(1px);
}

.time-machine-btn.primary {
  background: rgba(79, 143, 95, 0.92);
  color: #fff;
  border-color: rgba(47, 93, 58, 0.72);
}

.time-machine-btn.danger {
  background: rgba(238, 87, 87, 0.9);
  color: #fff;
  border-color: rgba(170, 45, 45, 0.75);
}

/* ==========================================
   宠物交互道具与专属联动动画（优化结合实体图片）
   ========================================== */

@keyframes galleryButtonGlow {
  0%, 100% {
    filter: drop-shadow(0 0 8px rgba(255, 211, 76, 0.85));
    transform: scale(1);
  }
  50% {
    filter: drop-shadow(0 0 18px rgba(255, 236, 135, 1));
    transform: scale(1.04);
  }
}

@keyframes harvestCellGlow {
  0%, 100% {
    box-shadow:
      inset 0 2px 0 rgba(255,255,255,0.16),
      inset 0 -4px 0 rgba(74, 41, 21, 0.18),
      0 0 8px rgba(255, 213, 82, 0.72);
  }
  50% {
    box-shadow:
      inset 0 2px 0 rgba(255,255,255,0.2),
      inset 0 -4px 0 rgba(74, 41, 21, 0.18),
      0 0 20px rgba(255, 237, 148, 1);
  }
}

/* 1. 待机呼吸感 (配合循环睡眠动画) */
.cat-idle {
  animation: breathe 3s ease-in-out infinite;
}
@keyframes breathe {
  0%, 100% { transform: scale(1) translateY(0); }
  50% { transform: scale(1.02) translateY(-3px); }
}

/* 2. 进食动作 (只需轻微点头) */
.cat-eating {
  animation: eatingAction 0.6s ease-in-out infinite;
}
@keyframes eatingAction {
  0%, 100% { transform: scale(1) translateY(0) rotate(0deg); }
  50% { transform: scale(1.01) translateY(3px) rotate(1deg); } 
}

/* 3. 开心撒娇 */
.cat-happy {
  animation: happyBounce 0.8s ease-in-out infinite;
}
@keyframes happyBounce {
  0%   { transform: scale(1) translateY(0); }
  25%  { transform: scale(1.03) translateY(-6px) rotate(-2deg); }
  50%  { transform: scale(0.97) translateY(2px) rotate(2deg); }
  75%  { transform: scale(1.03) translateY(-3px) rotate(-1deg); }
  100% { transform: scale(1) translateY(0); }
}

/* 4. 委屈拒绝 */
.cat-refused {
  animation: shakeHead 0.5s ease-in-out;
}
@keyframes shakeHead {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-4px) rotate(-1deg); }
  75% { transform: translateX(4px) rotate(1deg); }
}

/* 5. 拖拽悬空 */
.cat-lifted {
  animation: dangle 0.6s ease-in-out infinite alternate;
  transform-origin: top center;
}
@keyframes dangle {
  from { transform: rotate(-8deg) translateY(-10px); }
  to { transform: rotate(8deg) translateY(-10px); }
}
</style>

<style>
html.floating,
body.floating {
  background: transparent !important;
  margin: 0 !important;
  padding: 0 !important;
  width: 100% !important;
  height: 100% !important;
}
</style>
