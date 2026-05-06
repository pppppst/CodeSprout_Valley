<script setup>
import { ref, computed, watch, onMounted, onUnmounted, onBeforeUnmount, nextTick } from 'vue'
import { getActiveJieQi } from './utils/calendar'
import WeatherEffect from './components/WeatherEffect.vue'
import { SolarUtil } from 'lunar-javascript'

const isFloatingMode = ref(false)

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

const codeLines = ref(150)
const catExp = ref(0)
const message = ref('🐱 睡觉中...')
let offActivityUpdate = null
const todayPassed = ref(0)
const todayErrors = ref(0)

function applyActivityUpdate(data) {
  if (!data || typeof data !== 'object') return

  if (typeof data.codeAdded === 'number' && Number.isFinite(data.codeAdded)) {
    codeLines.value = Math.max(0, codeLines.value + data.codeAdded)
  }

  if (typeof data.codePassed === 'number' && Number.isFinite(data.codePassed) && data.codePassed > 0) {
    catExp.value += data.codePassed * 5
    todayPassed.value += data.codePassed
    message.value = `✅ ${data.codePassed} 个文件通过检查，经验提升中...`
    setTimeout(() => {
      message.value = '🐱 睡觉中...'
    }, 1800)
  }

  if (typeof data.errorCount === 'number' && Number.isFinite(data.errorCount) && data.errorCount > 0) {
    todayErrors.value += data.errorCount
    message.value = `⚠️ 发现 ${data.errorCount} 个新错误，快去看看吧！`
    setTimeout(() => {
      message.value = '🐱 睡觉中...'
    }, 2200)
  }
}

const feedCount = ref(0)
const waterCount = ref(0)
const foodStock = ref(20)
const waterStock = ref(20)
const isStatsVisible = ref(true)

function feedCat() {
  catExp.value += 10
  feedCount.value++
  foodStock.value = Math.max(foodStock.value - 10, 0)
  message.value = '😺 吧唧吧唧...好吃！(溢出经验+10)'
  setTimeout(() => message.value = '🐱 睡觉中...', 2000)
}

function waterPlant() {
  waterCount.value++
  waterStock.value = Math.max(waterStock.value - 10, 0)
  message.value = '🌱 咕噜咕噜...水好甜！'
  setTimeout(() => message.value = '🐱 睡觉中...', 2000)
}

function openGallery() {
  message.value = '📖 正在打开节气图鉴...'
  setTimeout(() => message.value = '🐱 睡觉中...', 2000)
}

function openSettings() {
  message.value = '⚙️ 正在打开设置...'
  setTimeout(() => message.value = '🐱 睡觉中...', 2000)
}

function openWeeklyReport() {
  message.value = '🗞️ 正在打开节气周报...'
  setTimeout(() => message.value = '🐱 睡觉中...', 2000)
}

function minimizeWindow() {
  window.api?.minimizeWindow?.()
}

function hideToTray() {
  window.api?.hideToTray?.()
}

function closeWindow() {
  window.api?.closeWindow?.()
}

function toggleStats() {
  isStatsVisible.value = !isStatsVisible.value
}

const activeGridCount = computed(() => {
  return Math.min(Math.floor(codeLines.value / 100), 5)
})

const highestRewardedThreshold = ref(activeGridCount.value)

watch(activeGridCount, (newValue) => {
  if (newValue > highestRewardedThreshold.value) {
    const gainedThresholds = newValue - highestRewardedThreshold.value
    const bonus = gainedThresholds * 20

    foodStock.value += bonus
    waterStock.value += bonus
    highestRewardedThreshold.value = newValue
  }
})

const now = ref(new Date())
let timerId = null
const uiScale = ref(1)

const mockDateString = ref(null)
const isTimeMachineOpen = ref(false)
const tmYear = ref('')
const tmMonth = ref('')
const tmDay = ref('')
const timeMachineError = ref('')
const tmYearInputEl = ref(null)

function pad2(n) {
  return String(n).padStart(2, '0')
}

function parseYmdString(ymd) {
  if (!ymd) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd)
  if (!m) return null
  return { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) }
}

function makeLocalDate(y, m, d) {
  return new Date(y, m - 1, d)
}

function isValidDateObj(dt) {
  return dt instanceof Date && !Number.isNaN(dt.getTime())
}

function isValidYmd(y, m, d) {
  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) return false
  const dt = makeLocalDate(y, m, d)
  return dt.getFullYear() === y && (dt.getMonth() + 1) === m && dt.getDate() === d
}

const isSandboxActive = computed(() => !!parseYmdString(mockDateString.value))

const effectiveDate = computed(() => {
  const parsed = parseYmdString(mockDateString.value)
  const candidate = parsed ? makeLocalDate(parsed.y, parsed.m, parsed.d) : now.value
  return isValidDateObj(candidate) ? candidate : now.value
})

function openTimeMachine() {
  const parsed = parseYmdString(mockDateString.value)
  const base = parsed ? makeLocalDate(parsed.y, parsed.m, parsed.d) : now.value

  tmYear.value = String(base.getFullYear())
  tmMonth.value = pad2(base.getMonth() + 1)
  tmDay.value = pad2(base.getDate())
  timeMachineError.value = ''
  isTimeMachineOpen.value = true

  nextTick(() => {
    tmYearInputEl.value?.focus?.()
  })
}

function closeTimeMachine() {
  isTimeMachineOpen.value = false
  timeMachineError.value = ''
}

function applyTimeMachine() {
  const y = Number(tmYear.value)
  const m = Number(tmMonth.value)
  const d = Number(tmDay.value)

  if (!Number.isInteger(y) || y <= 0) {
    timeMachineError.value = '提示：年份不合理，请输入正确的年份！'
    return
  }

  if (!Number.isInteger(m) || m < 1 || m > 12) {
    timeMachineError.value = '提示：月份不合理，请输入 1 到 12 之间的整数！'
    return
  }

  const maxDays = SolarUtil.getDaysOfMonth(y, m)

  if (!Number.isInteger(d) || d < 1 || d > maxDays) {
    timeMachineError.value = `提示：日期不合理！${y}年${m}月共有 ${maxDays} 天，请重新输入。`
    return
  }

  mockDateString.value = `${y}-${pad2(m)}-${pad2(d)}`
  isTimeMachineOpen.value = false
  timeMachineError.value = ''

  message.value = `⏳ 沙盘模式生效！前往 ${mockDateString.value}`
  setTimeout(() => (message.value = '🐱 睡觉中...'), 3000)
}

function exitTimeMachine() {
  mockDateString.value = null
  isTimeMachineOpen.value = false

  message.value = '⏰ 退出沙盘，已恢复现实时间！'
  setTimeout(() => (message.value = '🐱 睡觉中...'), 3000)
}

function updateUiScale() {
  const designWidth = 1365
  const designHeight = 768
  const scaleX = window.innerWidth / designWidth
  const scaleY = window.innerHeight / designHeight
  uiScale.value = Math.min(scaleX, scaleY)
}

function getSolarTerm(date) {
  const month = date.getMonth()
  const day = date.getDate()
  const year = date.getFullYear()
  return getActiveJieQi(year, month + 1, day)
}

const currentDate = computed(() => {
  const targetDate = isValidDateObj(effectiveDate.value) ? effectiveDate.value : now.value
  const year = targetDate.getFullYear()
  const month = String(targetDate.getMonth() + 1).padStart(2, '0')
  const day = String(targetDate.getDate()).padStart(2, '0')
  return `${year}年${month}月${day}日`
})

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

const currentBgUrl = computed(() => {
  const termName = (currentSolarTerm.value || '').trim();
  const pinyin = solarTermMap[termName];
  
  if (pinyin) {
    return new URL(`./assets/SolarTerm/${pinyin}.png`, import.meta.url).href;
  }
  return new URL('./assets/initial_background.png', import.meta.url).href;
})

const plantStyleConfig = {
  default: {
    width: '95px',
    left: '200px',
    bottom: '0px',
    transform: 'scale(5)',
    transformOrigin: 'bottom center'
  },
  xiazhi: {
    width: '100px',
    left: '450px',
    bottom: '160px',
    transform: 'scale(5.5)', 
    transformOrigin: 'bottom center'
  },
  lixia: {
    width: '100px', 
    left: '450px',
    bottom: '160px',
    transform: 'scale(4)',
    transformOrigin: 'bottom center'
  },
  lichun: {
    width: '100px', 
    left: '450px',
    bottom: '160px',
    transform: 'scale(4)',
    transformOrigin: 'bottom center'
  }
}

const currentPlant = computed(() => {
  const termName = (currentSolarTerm.value || '').trim()
  let pinyin = solarTermMap[termName] 
  
  if (!pinyin || !plantStyleConfig[pinyin]) {
    pinyin = 'default'
  }

  let imgSrc
  try {
    const imgPinyin = pinyin === 'default' ? 'xiazhi' : pinyin
    imgSrc = new URL(`./assets/${imgPinyin}/stage6.png`, import.meta.url).href
  } catch (e) {
    imgSrc = new URL(`./assets/xiazhi/stage6.png`, import.meta.url).href
  }

  const style = {
    ...plantStyleConfig.default,
    ...plantStyleConfig[pinyin]
  }

  return {
    src: imgSrc,
    style: style
  }
})

onMounted(() => {
  checkHash()
  window.addEventListener('hashchange', onHashChange)

  if (window.api?.onActivityUpdate) {
    offActivityUpdate = window.api.onActivityUpdate((payload) => {
      applyActivityUpdate(payload)
    })
  }

  if (window.api?.getLatestActivity) {
    window.api.getLatestActivity().then((payload) => {
      applyActivityUpdate(payload)
    }).catch((error) => {
      console.error('[CS Valley] Failed to load latest activity:', error)
    })
  }
  
  updateUiScale()
  window.addEventListener('resize', updateUiScale)

  timerId = setInterval(() => {
    now.value = new Date()
  }, 60000)
})

onUnmounted(() => {
  window.removeEventListener('resize', updateUiScale)
  if (offActivityUpdate) {
    offActivityUpdate()
    offActivityUpdate = null
  }
  if (timerId) {
    clearInterval(timerId)
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('hashchange', onHashChange)
})
</script>

<template>
  <div class="viewport-root" :class="{ 'floating-root': isFloatingMode }" :style="{ backgroundImage: `url(${currentBgUrl})` }">
    <WeatherEffect v-show="!isFloatingMode" :type="currentWeatherType" />
    <div 
      class="pet-container"
      :class="{ 'floating-mode': isFloatingMode }"
      style="-webkit-app-region: drag;"
      :style="isFloatingMode ? {} : { transform: `translate(-50%, -50%) scale(${uiScale})` }"
    >
      <!-- 实时状态面板 -->
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
              <div 
                v-for="i in 5" 
                :key="i" 
                class="grid" 
                :class="{ active: i <= activeGridCount }"
              ></div>
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

      <div
        class="pet-area"
        style="-webkit-app-region: no-drag;"
      >
        <div
          class="bubble"
          :style="{ top: bubbleTop }"
          @dblclick.stop="handleRestore"
        >{{ message }}</div>
        <div class="characters">
          <img class="cat-image" src="./assets/cat.png">
          <img
            v-show="!isFloatingMode"
            class="plant-image"
            :src="currentPlant.src"
            :style="currentPlant.style"
          />
        </div>
      </div>

      <div v-show="!isFloatingMode" class="action-panel" style="-webkit-app-region: no-drag;">
        <button class="image-btn" @click="feedCat" aria-label="喂猫粮">
          <img src="./assets/btn-feed.png" alt="喂猫粮" draggable="false">
        </button>
        <button class="image-btn" @click="waterPlant" aria-label="浇水">
          <img src="./assets/btn-water.png" alt="浇水" draggable="false">
        </button>
        <button class="image-btn" @click="openGallery" aria-label="图鉴合集">
          <img src="./assets/btn-gallery.png" alt="图鉴合集" draggable="false">
        </button>
        <button class="image-btn image-btn-settings" @click="openSettings" aria-label="设置">
          <img src="./assets/btn-settings.png" alt="设置" draggable="false">
        </button>
        <button class="image-btn image-btn-weekly-report" @click="openWeeklyReport" aria-label="节气周报">
          <img src="./assets/btn-weekly-report.png" alt="节气周报" draggable="false">
        </button>
        <button class="image-btn" @click="openTimeMachine" aria-label="沙盘模式">
          <img src="./assets/btn_shapanmode.png" alt="沙盘模式" draggable="false">
        </button>
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
            <input ref="tmYearInputEl" v-model.trim="tmYear" class="time-machine-input" inputmode="numeric" maxlength="4" placeholder="YYYY" aria-label="年份" @input="timeMachineError = ''" />
            <span class="time-machine-unit">年</span>
            <input v-model.trim="tmMonth" class="time-machine-input" inputmode="numeric" maxlength="2" placeholder="MM" aria-label="月份" @input="timeMachineError = ''" />
            <span class="time-machine-unit">月</span>
            <input v-model.trim="tmDay" class="time-machine-input" inputmode="numeric" maxlength="2" placeholder="DD" aria-label="日期" @input="timeMachineError = ''" />
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
  left: 27% !important;
  top: 13% !important;
  transform: translate(-50%, -50%) !important;
  -webkit-app-region: no-drag !important;
}

.pet-container.floating-mode .characters {
  left: 27% !important;
  top: 30% !important;
  transform: translate(-50%, -50%) !important;
}

.pet-container.floating-mode .pet-area {
  position: relative;
  flex: 0 0 auto;
  width: 280px;
  height: 400px;
}

/* ================= 修复：分离展开/折叠样式 ================= */

/* --- 1. 基础样式（展开态）--- */
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

/* --- 2. 展开态：标题栏位置（修复文字偏离问题）--- */
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

/* --- 3. 折叠态：独立样式（修复图片大小问题）--- */
.stats-box.collapsed {
  /* 背景图切换 */
  background-image: url('./assets/stats-collapsed.png') !important;
  background-color: transparent;
  background-repeat: no-repeat;
  background-position: center;
  
  /* 关键：让容器适应图片大小，图片完整显示 */
  background-size: contain; 
  overflow: visible; /* 允许图片超出容器一点点也没关系 */
  
  /* 尺寸：根据你的图片实际比例调整 */
  width: 220px;   /* 增大宽度 */
  height: 140px;  /* 增大高度 */
  
  /* 位置：与日历图标齐平 */
  top: 10px;      /* 微调垂直对齐 */
  left: 920px;    /* 保持水平位置 */
  transform: none;
  
  box-shadow: none;
}

/* 折叠态：隐藏文字，但保留点击区域 */
.stats-box.collapsed .stats-header {
  position: absolute;
  inset: 0; /* 铺满整个容器，确保点击区域完整 */
  width: 100%;
  height: 100%;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  opacity: 0; /* 完全透明 */
  pointer-events: auto; /* 确保可点击 */
}

/* 折叠态：彻底隐藏文字和箭头 */
.stats-box.collapsed .stats-title,
.stats-box.collapsed .toggle-arrow {
  display: none;
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
}
.cat-image:hover {
  transform: scale(1.1);
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

.image-btn-settings {
  width: 150px;
  margin-right: 0px;
  margin-top: 0;
}

.image-btn-weekly-report {
  width: 150px;
  margin-right: 0;
  margin-top: 0;
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

.time-machine-unit {
  font-size: 16px;
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