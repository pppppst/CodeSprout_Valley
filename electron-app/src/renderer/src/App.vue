<script setup>
import { ref, computed, watch, onMounted, onUnmounted, onBeforeUnmount, nextTick } from 'vue'
import { getActiveJieQi } from './utils/calendar'
import { registerAccount, loginAccount, fetchCloudSave, syncCloudSave } from './utils/cloudApi'
import WeatherEffect from './components/WeatherEffect.vue'
import { SolarUtil } from 'lunar-javascript'

// ==========================================
// 1. 悬浮窗与基础环境配置
// ==========================================
const isFloatingMode = ref(false)

const authUsername = ref('')
const authPassword = ref('')
const authStatusMessage = ref('等待登录后同步云端存档')
const cloudToken = ref(localStorage.getItem('codeSproutToken') || '')
const loggedInUser = ref(localStorage.getItem('codeSproutUser') || '')
const isCloudBusy = ref(false)
const lastSyncTime = ref(localStorage.getItem('codeSproutLastSyncTime') || '')
const isReportOpen = ref(false)

function setAuthSession(token, username) {
  cloudToken.value = token
  loggedInUser.value = username
  localStorage.setItem('codeSproutToken', token)
  localStorage.setItem('codeSproutUser', username)
}

function clearAuthSession() {
  cloudToken.value = ''
  loggedInUser.value = ''
  lastSyncTime.value = ''
  localStorage.removeItem('codeSproutToken')
  localStorage.removeItem('codeSproutUser')
  localStorage.removeItem('codeSproutLastSyncTime')
}

function applyCloudSave(save) {
  if (!save) return

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
    applyCloudSave(result.data)
    await loadCloudSave()
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

function handleLogout() {
  clearAuthSession()
  authUsername.value = ''
  authPassword.value = ''
  codeLines.value = 0
  syncedCodeLines.value = 0
  foodStock.value = 0
  waterStock.value = 0
  authStatusMessage.value = '已退出登录，本地账号状态已清空'
}


const bubbleTop = computed(() => {
  return isFloatingMode.value ? '60%' : '69%'
})

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

function handleRestore() {
  if (window.api && typeof window.api.restoreMainUI === 'function') {
    window.api.restoreMainUI()
  }
}

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
const syncedCodeLines = ref(0);
const catExp = ref(0)
const message = ref('🐱 睡觉中...')

const feedCount = ref(0)
const waterCount = ref(0)
const foodStock = ref(20)
const waterStock = ref(20)

const todayPassed = ref(0)
const todayErrors = ref(0)
let offActivityUpdate = null
const isStatsVisible = ref(true)

const CODE_LINES_PER_REWARD = 50
const RESOURCE_PER_REWARD = 20
const WATER_COST = 20
const MAX_WATERINGS_PER_TERM = 120
const MAX_WATER_REWARDED_LINES = MAX_WATERINGS_PER_TERM * CODE_LINES_PER_REWARD

const plantWaterByTerm = ref({})
const suppressResourceRewards = ref(false)

// ==========================================
// 3. 宠物交互控制 (带跨日持久化的微型状态机)
// ==========================================
// 可选状态: 'idle' | 'eating' | 'happy' | 'refused' | 'playing'
const catState = ref('idle')
let catStateTimer = null

// 新增：动态加载图片资源映射
const catImages = {
  idle: new URL('./assets/Cat/cat_sleep.png', import.meta.url).href,
  eating: new URL('./assets/Cat/cat_eat.png', import.meta.url).href,
  happy: new URL('./assets/Cat/cat_happy.png', import.meta.url).href,
  refused: new URL('./assets/Cat/cat_sad.png', import.meta.url).href,
  playing: new URL('./assets/Cat/cat_watching.png', import.meta.url).href // 玩球时使用专注看球的状态
}

// 新增：根据状态动态计算当前的猫咪图片
const currentCatImage = computed(() => {
  return catImages[catState.value] || catImages.idle
})

// 获取今天日期的字符串格式，例如 "2026-5-7"
function getTodayString() {
  const d = new Date()
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
}

// 从本地缓存读取最后一次喂食的日期
const lastFedDate = ref(localStorage.getItem('cs_valley_last_fed_date') || '')

// 优化后的状态重置函数：记住先前的持久状态
function resetCatState(delay = 2000) {
  if (catStateTimer) clearTimeout(catStateTimer)
  catStateTimer = setTimeout(() => {
    // 检查今天是否已经喂过，如果是，恢复为玩球/专注状态
    if (lastFedDate.value === getTodayString()) {
      catState.value = 'playing'
      message.value = '⚽ 充满活力，玩球中！'
    } else {
      catState.value = 'idle'
      message.value = '🐱 睡觉中...'
    }
  }, delay)
}



function feedCat() {
  if (foodStock.value < 10) {
    catState.value = 'refused'
    message.value = '😿 喵...肚子饿，可是猫粮不足 10 份！'
    resetCatState(2500)
    return
  }

  // 结算资源
  catExp.value += 10
  feedCount.value++
  foodStock.value -= 10
  
  catState.value = 'eating'
  message.value = '😺 吧唧吧唧...猫粮真香！(经验+10)'

  // 吃完后进入“玩球”状态，并记录日期
  if (catStateTimer) clearTimeout(catStateTimer)
  catStateTimer = setTimeout(() => {
    catState.value = 'playing'
    message.value = '⚽ 充满活力，玩球中！'
    
    // 记录今天已经喂过了
    const todayStr = getTodayString()
    lastFedDate.value = todayStr
    localStorage.setItem('cs_valley_last_fed_date', todayStr)
  }, 1500)
}

function interactWithCat() {
  if (catState.value === 'eating') return // 吃饭时防打扰

  // 即使在玩球，也可以摸摸它，但摸完要继续玩球
  catState.value = 'happy'
  message.value = '❤️ 呼噜呼噜...最喜欢你了！'
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

  message.value = '🌱 咕噜咕噜...水好甜！'
  resetCatState(2000)
}

// ==========================================
// 4. 插件数据更新监听
// ==========================================
function applyActivityUpdate(data) {
  if (!data || typeof data !== 'object') return
  if (isSandboxActive.value) return

  if (typeof data.codeAdded === 'number' && Number.isFinite(data.codeAdded)) {
    codeLines.value = Math.max(0, codeLines.value + data.codeAdded)
  }

  if (typeof data.codePassed === 'number' && Number.isFinite(data.codePassed) && data.codePassed > 0) {
    catExp.value += data.codePassed * 5
    todayPassed.value += data.codePassed
    message.value = `✅ ${data.codePassed} 个文件通过，经验提升中...`
    catState.value = 'happy'
    resetCatState(2500)
  }

  if (typeof data.errorCount === 'number' && Number.isFinite(data.errorCount) && data.errorCount > 0) {
    todayErrors.value += data.errorCount
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
// 5. 辅助功能 (图鉴、设置、周报)
// ==========================================
function openGallery() {
  message.value = '📖 正在打开节气图鉴...'
  resetCatState(2000)
}
function openSettings() {
  message.value = '⚙️ 正在打开设置...'
  resetCatState(2000)
}
function openWeeklyReport() {
  isReportOpen.value = true
  message.value = '🗞️ 正在打开节气周报...'
  resetCatState(2000)
}
function closeWeeklyReport() {
  isReportOpen.value = false
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

const DEFAULT_PLANT_TERM = 'xiazhi'
const DEFAULT_PLANT_STAGE = 1
const plantImageModules = import.meta.glob('./assets/*/stage*.png', {
  eager: true,
  import: 'default'
})

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
  return new URL('./assets/initial_background.png', import.meta.url).href;
})

function getPlantStageByWaterings(waterings) {
  if (waterings >= 120) return 4//120
  if (waterings >= 60) return 3//60
  if (waterings >= 30) return 2//30
  return 1
}

const currentPlantStage = computed(() => {
  const waterings = plantWaterByTerm.value[currentTermPinyin.value] || 0
  return getPlantStageByWaterings(waterings)
})

const weeklyReport = computed(() => {
  const totalActions = feedCount.value + waterCount.value
  const totalChecks = todayPassed.value + todayErrors.value
  const passRate = totalChecks === 0
    ? '暂无检测记录'
    : `${Math.round((todayPassed.value / totalChecks) * 100)}%`

  return {
    title: `${currentSolarTerm.value || '当前节气'}成长报告`,
    date: currentDate.value,
    owner: loggedInUser.value || '本地用户',
    totalCodeLines: codeLines.value,
    todayPassed: todayPassed.value,
    todayErrors: todayErrors.value,
    passRate,
    totalActions,
    plantStage: currentPlantStage.value,
    syncText: lastSyncTime.value ? `最近同步：${lastSyncTime.value}` : '尚未完成云端同步',
    summary: totalActions > 0
      ? `本节气已照料 ${totalActions} 次，植物成长到第 ${currentPlantStage.value} 阶段。`
      : `本节气植物处于第 ${currentPlantStage.value} 阶段，继续写代码和照料即可推进成长。`
  }
})

const plantImageConfig = {
  // 全局默认配置
  default: {
    width: '95px', left: '200px', bottom: '0px',
    transform: 'scale(5)', transformOrigin: 'bottom center'
  },

  // ===================== 24节气 按顺序排列 =====================
  // 春季节气
  lichun: { // 立春
    default: {
      width: '100px',
      left: '450px',
      bottom: '160px',
      transform: 'scale(3.5)',
      transformOrigin: 'bottom center'
    },
    stage1: {
      width: '100px',
      left: '450px',
      bottom: '160px',
      transform: 'scale(2)',
      transformOrigin: 'bottom center'
    },
    stage2: {
      width: '100px',
      left: '450px',
      bottom: '160px',
      transform: 'scale(3)',
      transformOrigin: 'bottom center'
    },
    stage3: {},
    stage4: {}
  },
  yushui: { // 雨水
    default: {
      width: '100px',
      left: '450px',
      bottom: '160px',
      transform: 'scale(4)',
      transformOrigin: 'bottom center'
    },
    stage1: {
      bottom: '80px'
    },
    stage2: {
      bottom: '170px'
    },
    stage3: {
      bottom: '140px'
    },
    stage4: {}
  },
  jingzhe: { // 惊蛰
    default: {
      width: '100px',
      left: '450px',
      bottom: '180px',
      transform: 'scale(4)',
      transformOrigin: 'bottom center'
    },
    stage2: {
      bottom: '120px'
    },
    stage1: {
      width: '100px',
      left: '450px',
      bottom: '150px',
      transform: 'scale(3)',
      transformOrigin: 'bottom center'
    },
    stage3: {
      bottom: '150px'
    },
    stage4: {}
  },
  chunfen: { // 春分
    default: {
      width: '100px',
      left: '450px',
      bottom: '160px',
      transform: 'scale(4)',
      transformOrigin: 'bottom center'
    },
    stage1: {
      width: '100px',
      left: '450px',
      bottom: '160px',
      transform: 'scale(2)',
      transformOrigin: 'bottom center'
    },
    stage2: {
      transform: 'scale(3)'
    },
    stage3: {},
    stage4: {}
  },
  qingming: { // 清明
    default: {
      width: '100px',
      left: '450px',
      bottom: '160px',
      transform: 'scale(3.5)',
      transformOrigin: 'bottom center'
    },
    stage1: {},
    stage2: {
      bottom: '150px'
    },
    stage3: {},
    stage4: {}
  },
  guyu: { // 谷雨
    default: {
      width: '100px',
      left: '450px',
      bottom: '160px',
      transform: 'scale(4)',
      transformOrigin: 'bottom center'
    },
    stage1: {
      width: '100px',
      left: '450px',
      bottom: '100px',
      transform: 'scale(4)',
      transformOrigin: 'bottom center'
    },
    stage2: {
      width: '100px',
      left: '450px',
      bottom: '160px',
      transform: 'scale(4)',
      transformOrigin: 'bottom center'
    },
    stage3: {
      width: '100px',
      left: '450px',
      bottom: '120px',
      transform: 'scale(4)',
      transformOrigin: 'bottom center'
    },
    stage4: {
      width: '100px',
      left: '450px',
      bottom: '160px',
      transform: 'scale(3.5)',
      transformOrigin: 'bottom center'
    }
  },

  // 夏季节气
  lixia: { // 立夏
    default: {
      width: '100px',
      left: '450px',
      bottom: '160px',
      transform: 'scale(4)',
      transformOrigin: 'bottom center'
    },
    stage1: {},
    stage2: {},
    stage3: {},
    stage4: {}
  },
  xiaoman: { // 小满
    default: {
      width: '100px',
      left: '440px',
      bottom: '120px',
      transform: 'scale(2.5)',
      transformOrigin: 'bottom center'
    },
    stage1: {},
    stage2: {},
    stage3: {},
    stage4: {}
  },
  mangzhong: { // 芒种
    default: {
      width: '100px',
      left: '450px',
      bottom: '160px',
      transform: 'scale(4)',
      transformOrigin: 'bottom center'
    },
    stage1: {},
    stage2: {},
    stage3: {},
    stage4: {}
  },
  xiazhi: { // 夏至
    default: {
      width: '100px',
      left: '450px',
      bottom: '160px',
      transform: 'scale(4.5)',
      transformOrigin: 'bottom center'
    },
    stage1: {},
    stage2: {},
    stage3: {},
    stage4: {}
  },
  xiaoshu: { // 小暑
    default: {
      width: '100px',
      left: '450px',
      bottom: '160px',
      transform: 'scale(5)',
      transformOrigin: 'bottom center'
    },
    stage1: { transform: 'scale(3)'
    },
    stage2: {},
    stage3: {},
    stage4: {}
  },
  dashu: { // 大暑
    default: {
      width: '100px',
      left: '450px',
      bottom: '160px',
      transform: 'scale(2.5)',
      transformOrigin: 'bottom center'
    },
    stage1: {bottom: '140px'},
    stage2: {},
    stage3: {},
    stage4: {}
  },

  // 秋季节气
  liqiu: { // 立秋
    default: {
      width: '100px',
      left: '450px',
      bottom: '160px',
      transform: 'scale(4)',
      transformOrigin: 'bottom center'
    },
    stage1: {
      width: '100px',
      left: '450px',
      bottom: '170px',
      transform: 'scale(2)',
      transformOrigin: 'bottom center'
    },
    stage2: {
      width: '100px',
      left: '450px',
      bottom: '160px',
      transform: 'scale(2.5)',
      transformOrigin: 'bottom center'
    },
    stage3: {
      width: '100px',
      left: '450px',
      bottom: '160px',
      transform: 'scale(3)',
      transformOrigin: 'bottom center'
    },
    stage4: {
      width: '100px',
      left: '450px',
      bottom: '160px',
      transform: 'scale(3.5)',
      transformOrigin: 'bottom center'
    }
  },
  chushu: { // 处暑
    default: {
      width: '100px',
      left: '450px',
      bottom: '160px',
      transform: 'scale(4)',
      transformOrigin: 'bottom center'
    },
    stage1: {
      width: '100px',
      left: '450px',
      bottom: '170px',
      transform: 'scale(1.5)',
      transformOrigin: 'bottom center'
    },
    stage2: {
      width: '100px',
      left: '450px',
      bottom: '160px',
      transform: 'scale(2.5)',
      transformOrigin: 'bottom center'
    },
    stage3: {
      width: '100px',
      left: '450px',
      bottom: '160px',
      transform: 'scale(2.5)',
      transformOrigin: 'bottom center'
    },
    stage4: {
      width: '100px',
      left: '450px',
      bottom: '160px',
      transform: 'scale(2.8)',
      transformOrigin: 'bottom center'
    }
  },
  bailu: { // 白露
    default: {
      width: '100px',
      left: '450px',
      bottom: '160px',
      transform: 'scale(4)',
      transformOrigin: 'bottom center'
    },
    stage1: {
      width: '100px',
      left: '450px',
      bottom: '170px',
      transform: 'scale(1.5)',
      transformOrigin: 'bottom center'
    },
    stage2: {
      width: '100px',
      left: '450px',
      bottom: '160px',
      transform: 'scale(2)',
      transformOrigin: 'bottom center'
    },
    stage3: {
      width: '100px',
      left: '450px',
      bottom: '160px',
      transform: 'scale(2.5)',
      transformOrigin: 'bottom center'
    },
    stage4: {
      width: '100px',
      left: '450px',
      bottom: '160px',
      transform: 'scale(2.5)',
      transformOrigin: 'bottom center'
    }
  },
  qiufen: { // 秋分
    default: {
      width: '100px',
      left: '450px',
      bottom: '160px',
      transform: 'scale(4)',
      transformOrigin: 'bottom center'
    },
    stage1: {
      width: '100px',
      left: '450px',
      bottom: '170px',
      transform: 'scale(1.5)',
      transformOrigin: 'bottom center'
    },
    stage2: {
      width: '100px',
      left: '450px',
      bottom: '160px',
      transform: 'scale(1.8)',
      transformOrigin: 'bottom center'
    },
    stage3: {
      width: '100px',
      left: '450px',
      bottom: '160px',
      transform: 'scale(2.2)',
      transformOrigin: 'bottom center'
    },
    stage4: {
      width: '100px',
      left: '450px',
      bottom: '160px',
      transform: 'scale(2)',
      transformOrigin: 'bottom center'
    }
  },
  hanlu: { // 寒露
    default: {
      width: '100px',
      left: '450px',
      bottom: '160px',
      transform: 'scale(4)',
      transformOrigin: 'bottom center'
    },
    stage1: {
      width: '100px',
      left: '450px',
      bottom: '170px',
      transform: 'scale(2)',
      transformOrigin: 'bottom center'
    },
    stage2: {
      width: '100px',
      left: '450px',
      bottom: '160px',
      transform: 'scale(3)',
      transformOrigin: 'bottom center'
    },
    stage3: {
      width: '100px',
      left: '450px',
      bottom: '160px',
      transform: 'scale(3)',
      transformOrigin: 'bottom center'
    },
    stage4: {
      width: '100px',
      left: '450px',
      bottom: '160px',
      transform: 'scale(3.5)',
      transformOrigin: 'bottom center'
    }
  },
  shuangjiang: { // 霜降
    default: {
      width: '100px',
      left: '450px',
      bottom: '160px',
      transform: 'scale(4)',
      transformOrigin: 'bottom center'
    },
    stage1: {
      width: '100px',
      left: '450px',
      bottom: '160px',
      transform: 'scale(2)',
      transformOrigin: 'bottom center'
    },
    stage2: {
      width: '100px',
      left: '450px',
      bottom: '160px',
      transform: 'scale(2)',
      transformOrigin: 'bottom center'
    },
    stage3: {
      width: '100px',
      left: '450px',
      bottom: '160px',
      transform: 'scale(2.5)',
      transformOrigin: 'bottom center'
    },
    stage4: {
      width: '100px',
      left: '450px',
      bottom: '160px',
      transform: 'scale(2)',
      transformOrigin: 'bottom center'
    }
  },

  // 冬季节气
  lidong: { // 立冬
    default: {
      width: '50px',
      left: '450px',
      bottom: '120px',
      transform: 'scale(4)',
      transformOrigin: 'bottom center'
    },
    stage1: {},
    stage2: {},
    stage3: {},
    stage4: {}
  },
  xiaoxue: { // 小雪
    default: {
      width: '50px',
      left: '450px',
      bottom: '130px',
      transform: 'scale(4)',
      transformOrigin: 'bottom center'
    },
    stage1: {},
    stage2: {},
    stage3: {},
    stage4: {}
  },
  daxue: { // 大雪
    default: {
      width: '60px',
      left: '450px',
      bottom: '110px',
      transform: 'scale(4)',
      transformOrigin: 'bottom center'
    },
    stage1: {},
    stage2: {},
    stage3: {},
    stage4: {}
  },
  dongzhi: { // 冬至
    default: {
      width: '80px',
      left: '450px',
      bottom: '160px',
      transform: 'scale(4)',
      transformOrigin: 'bottom center'
    },
    stage1: {},
    stage2: {},
    stage3: {},
    stage4: {}
  },
  xiaohan: { // 小寒
    default: {
      width: '60px',
      left: '450px',
      bottom: '130px',
      transform: 'scale(4)',
      transformOrigin: 'bottom center'
    },
    stage1: {},
    stage2: {},
    stage3: {},
    stage4: {}
  },
  dahan: { // 大寒
    default: {
      width: '60px',
      left: '455px',
      bottom: '140px',
      transform: 'scale(4)',
      transformOrigin: 'bottom center'
    },
    stage1: {},
    stage2: {},
    stage3: {},
    stage4: {}
  }
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
    plantWaterByTerm: { ...plantWaterByTerm.value }
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
  const y = Number(tmYear.value), m = Number(tmMonth.value), d = Number(tmDay.value)
  if (!Number.isInteger(y) || y <= 0) { timeMachineError.value = '年份不合理'; return }
  if (!Number.isInteger(m) || m < 1 || m > 12) { timeMachineError.value = '月份不合理'; return }
  const maxDays = SolarUtil.getDaysOfMonth(y, m)
  if (!Number.isInteger(d) || d < 1 || d > maxDays) { timeMachineError.value = `日期不合理`; return }

  if (!sandboxSnapshot.value) sandboxSnapshot.value = captureCurrentState()
  
  const sandboxDate = makeLocalDate(y, m, d)
  mockDateString.value = `${y}-${pad2(m)}-${pad2(d)}`
  
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
  plantWaterByTerm.value = { [termKey]: 0 }

  isTimeMachineOpen.value = false
  timeMachineError.value = ''
  message.value = `⏳ 沙盘生效！前往 ${mockDateString.value}`
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
// 8. 生命周期管理 (包含跨日重置校验)
// ==========================================
onMounted(() => {
  checkHash()
  window.addEventListener('hashchange', onHashChange)

  if (window.api?.onActivityUpdate) {
    offActivityUpdate = window.api.onActivityUpdate(applyActivityUpdate)
  }

  if (window.api?.getLatestActivity) {
    window.api.getLatestActivity().then(applyActivityUpdate).catch(err => console.error('[CS Valley]', err))
  }

  if (cloudToken.value) {
    loadCloudSave()
      .then(() => {
        authStatusMessage.value = '已恢复登录状态，云端存档已加载'
      })
      .catch((error) => {
        clearAuthSession()
        authStatusMessage.value = `登录状态失效：${error.message}`
      })
  }
  
  updateUiScale()
  window.addEventListener('resize', updateUiScale)

  // 初始化时校验跨日状态
  if (lastFedDate.value === getTodayString()) {
    catState.value = 'playing'
    message.value = '⚽ 充满活力，玩球中！'
  } else {
    catState.value = 'idle'
    message.value = '🐱 睡觉中...'
  }

  timerId = setInterval(() => {
    now.value = new Date()

    // 跨日重置逻辑：每分钟检查一次，发现是第二天则清除状态
    const todayStr = getTodayString()
    if (lastFedDate.value && lastFedDate.value !== todayStr) {
      lastFedDate.value = ''
      localStorage.removeItem('cs_valley_last_fed_date') 
      
      if (catState.value === 'playing') {
        catState.value = 'idle'
        message.value = '🐱 昨天玩累了，睡觉中...'
      }
    }
  }, 60000)
})

onUnmounted(() => {
  window.removeEventListener('resize', updateUiScale)
  if (offActivityUpdate) {
    offActivityUpdate()
    offActivityUpdate = null
  }
  if (timerId) clearInterval(timerId)
})

onBeforeUnmount(() => {
  window.removeEventListener('hashchange', onHashChange)
})
</script>

<template>
  <div v-show="!isFloatingMode" class="cloud-panel" style="-webkit-app-region: no-drag;">
    <div class="cloud-panel-title">云端账号</div>

    <div v-if="loggedInUser" class="cloud-user-card">
      <div class="cloud-user-name">{{ loggedInUser }}</div>
      <div class="cloud-user-meta">{{ lastSyncTime ? `最近同步：${lastSyncTime}` : '' }}</div>
      <div class="cloud-actions">
        <button class="cloud-btn primary" :disabled="isCloudBusy" @click="handleCloudSync">同步</button>
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
  <div class="viewport-root" :class="{ 'floating-root': isFloatingMode }" :style="{ backgroundImage: `url(${currentBgUrl})` }">
    <WeatherEffect v-show="!isFloatingMode" :type="currentWeatherType" />
    <div 
      class="pet-container"
      :class="{ 'floating-mode': isFloatingMode }"
      style="-webkit-app-region: drag;"
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
        <div v-show="isStatsVisible" class="stats-content">
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
        <div class="bubble" :style="{ top: bubbleTop }" @dblclick.stop="handleRestore">{{ message }}</div>
        
        <div class="characters">
          <div v-if="catState === 'playing'" class="toy-ball"></div>

          <img
            class="cat-image"
            :class="{
              'cat-idle': catState === 'idle',
              'cat-eating': catState === 'eating',
              'cat-happy': catState === 'happy',
              'cat-refused': catState === 'refused',
              'cat-playing': catState === 'playing'
            }"
            :src="currentCatImage"
            draggable="false"
            @click="interactWithCat"
            :style="isFloatingMode ? '-webkit-app-region: drag; pointer-events: auto;' : ''"
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
        <button class="image-btn" @click="openGallery" aria-label="图鉴合集"><img src="./assets/btn-gallery.png" draggable="false"></button>
        <button class="image-btn image-btn-settings" @click="openSettings" aria-label="设置"><img src="./assets/btn-settings.png" draggable="false"></button>
        <button class="image-btn image-btn-weekly-report" @click="openWeeklyReport" aria-label="节气周报"><img src="./assets/btn-weekly-report.png" draggable="false"></button>
        <button class="image-btn" @click="openTimeMachine" aria-label="沙盘模式"><img src="./assets/btn_shapanmode.png" draggable="false"></button>
      </div>

      <div
        v-if="isReportOpen && !isFloatingMode"
        class="report-mask"
        style="-webkit-app-region: no-drag;"
        @click.self="closeWeeklyReport"
      >
        <section class="report-panel">
          <div class="report-header">
            <div>
              <p class="report-date">{{ weeklyReport.date }}</p>
              <h2>{{ weeklyReport.title }}</h2>
            </div>
            <button class="report-close" @click="closeWeeklyReport">×</button>
          </div>

          <p class="report-summary">{{ weeklyReport.summary }}</p>

          <div class="report-grid">
            <div class="report-item"><span>累计代码</span><strong>{{ weeklyReport.totalCodeLines }}</strong></div>
            <div class="report-item"><span>通过率</span><strong>{{ weeklyReport.passRate }}</strong></div>
            <div class="report-item"><span>今日通过</span><strong>{{ weeklyReport.todayPassed }}</strong></div>
            <div class="report-item"><span>今日报错</span><strong>{{ weeklyReport.todayErrors }}</strong></div>
            <div class="report-item"><span>照料次数</span><strong>{{ weeklyReport.totalActions }}</strong></div>
            <div class="report-item"><span>植物阶段</span><strong>{{ weeklyReport.plantStage }}</strong></div>
          </div>

          <div class="report-footer"><span>{{ weeklyReport.owner }}</span><span>{{ weeklyReport.syncText }}</span></div>
        </section>
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
          <div v-if="timeMachineError" class="time-machine-error">{{ timeMachineError }}</div>
          <div class="time-machine-actions">
            <button class="time-machine-btn" @click="applyTimeMachine">确认应用</button>
            <button class="time-machine-btn" @click="closeTimeMachine">取消</button>
            <button v-if="isSandboxActive" class="time-machine-btn danger" @click="exitTimeMachine">退出沙盘</button>
          </div>
        </div>
      </div>

    </div>
  </div>
</template>

<style scoped>
/* 原有的基础与布局样式 */
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

.pet-container.floating-mode {
  position: relative;
  top: 0;
  left: 0;
  transform: none !important;
  background: transparent !important;
  background-image: none !important;
  width: auto !important;
  height: auto !important;
  overflow: visible;
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  padding: 20px;
  border-radius: 0;
}

.pet-container.floating-mode .bubble {
  left: 40% !important;
  top: 30% !important; 
  transform: translate(-50%, -50%) !important;
  -webkit-app-region: no-drag !important;
  z-index: 10 !important;         
  pointer-events: auto !important;
}

.pet-container.floating-mode .characters {
  left: 53% !important;
  top: 50% !important;
  transform: translate(-50%, -50%) !important;
  z-index: 1 !important;           
}

.pet-container.floating-mode .pet-area {
  position: relative;
  flex: 0 0 auto;
  width: 280px;
  height: 400px;
}

.stats-box {
  position: absolute;
  top: 30px;
  left: 78%;
  transform: translateX(-50%);
  width: 310px;
  height: 400px;
  overflow: visible;
  transition: all 0.3s ease;
  background-image: url('./assets/stats-expanded.png');
  background-repeat: no-repeat;
  background-position: center;
  background-size: 100% 100%;
  border: none;
  box-shadow: none;
  z-index: 4;
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
  width: 220px;   
  height: 140px;  
  top: 10px;      
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
  min-width: 120px;
  transform: translate(-50%, -50%);
  background: rgba(255, 255, 255, 0.95);
  color: #333;
  padding: 12px 20px;
  border-radius: 20px;
  font-weight: bold;
  font-size: 18px;
  margin-bottom: 20px;
  box-shadow: 0 4px 6px rgba(0,0,0,0.1);
  pointer-events: auto;
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
  bottom: 75px;
  width: 250px;
  filter: drop-shadow(0px 10px 10px rgba(0,0,0,0.5));
  transition: transform 0.2s;
  transform-origin: bottom center;
  cursor: pointer; 
  will-change: transform; 
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

.time-machine-actions {
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

.time-machine-btn.danger {
  background: rgba(238, 87, 87, 0.9);
  color: #fff;
  border-color: rgba(170, 45, 45, 0.75);
}

/* ==========================================
   宠物交互道具与专属联动动画（优化结合实体图片）
   ========================================== */

/* --- 道具：玩具球 --- */
/* 因为你有了专注看球(cat_watching.png)的状态，我们保留跳动的球，使其组合起来像玩球动作 */
.toy-ball {
  position: absolute;
  left: -30px;
  bottom: 80px;
  width: 48px;
  height: 48px;
  background: radial-gradient(circle at 30% 30%, #ff6b6b, #c92a2a); 
  border-radius: 50%;
  box-shadow: 0 5px 5px rgba(0,0,0,0.4);
  z-index: 2;
  animation: ballRollBounce 1.5s linear infinite;
}

@keyframes ballRollBounce {
  0%   { transform: translateX(0) translateY(0) rotate(0deg); }
  20%  { transform: translateX(20px) translateY(-15px) rotate(90deg); } 
  40%  { transform: translateX(40px) translateY(0) rotate(180deg); } 
  60%  { transform: translateX(60px) translateY(-10px) rotate(270deg); } 
  80%  { transform: translateX(70px) translateY(0) rotate(360deg); } 
  100% { transform: translateX(0) translateY(0) rotate(0deg); } 
}

/* 1. 待机呼吸感 (配合 cat_sleep.png) */
.cat-idle {
  animation: breathe 3s ease-in-out infinite;
}
@keyframes breathe {
  0%, 100% { transform: scale(1) translateY(0); }
  50% { transform: scale(1.02) translateY(-3px); }
}

/* 2. 进食动作 (配合 cat_eat.png，只需轻微点头) */
.cat-eating {
  animation: eatingAction 0.6s ease-in-out infinite;
}
@keyframes eatingAction {
  0%, 100% { transform: scale(1) translateY(0) rotate(0deg); }
  50% { transform: scale(1.01) translateY(3px) rotate(1deg); } 
}

/* 3. 开心撒娇 (配合 cat_happy.png) */
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

/* 4. 委屈拒绝 (配合 cat_sad.png) */
.cat-refused {
  animation: shakeHead 0.5s ease-in-out;
}
@keyframes shakeHead {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-4px) rotate(-1deg); }
  75% { transform: translateX(4px) rotate(1deg); }
}

/* 5. 持续玩球状态 (配合 cat_watching.png 与玩具球联动) */
.cat-playing {
  animation: catPlayAction 1.5s linear infinite;
}
/* 调整为更轻微的追随动作，因为 watching 图片本身是静态专注的 */
@keyframes catPlayAction {
  0%   { transform: translateX(0) scaleX(1); } 
  35%  { transform: translateX(10px) scaleX(1); } 
  40%  { transform: translateX(20px) scaleX(1) translateY(-4px); } 
  60%  { transform: translateX(30px) scaleX(1); } 
  65%  { transform: translateX(30px) scaleX(1); } /* 保持原向专注看球 */
  95%  { transform: translateX(0) scaleX(1) translateY(-2px); } 
  100% { transform: translateX(0) scaleX(1); } 
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