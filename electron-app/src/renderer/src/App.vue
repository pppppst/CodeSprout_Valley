<script setup>
import { ref, computed, watch, onMounted, onUnmounted, onBeforeUnmount } from 'vue'
import { getActiveJieQi } from './utils/calendar'

// ================= 悬浮窗模式判断 =================
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

// 双击恢复主窗口（悬浮模式下，绑定到内部无拖拽区域）
function handleRestore() {
  if (window.api && typeof window.api.restoreMainUI === 'function') {
    window.api.restoreMainUI()
  }
}

// ================= 核心数据 =================
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

// 统计数据
const feedCount = ref(0)
const waterCount = ref(0)
const foodStock = ref(20)
const waterStock = ref(20)
const isStatsVisible = ref(true) // 控制面板折叠

// ================= 核心功能函数 =================
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

// ================= 窗口控制函数 =================
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

// ================= 经验与奖励逻辑 =================
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

// ================= UI与时间逻辑 =================
const now = ref(new Date())
let timerId = null
const uiScale = ref(1)

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
  const year = now.value.getFullYear()
  const month = String(now.value.getMonth() + 1).padStart(2, '0')
  const day = String(now.value.getDate()).padStart(2, '0')
  return `${year}年${month}月${day}日`
})

const currentSolarTerm = computed(() => getSolarTerm(now.value))

// ================= 动态背景逻辑 =================
// 1. 建立节气中文到拼音的映射字典
const solarTermMap = {
  '立春': 'lichun', '雨水': 'yushui', '惊蛰': 'jingzhe', '春分': 'chunfen',
  '清明': 'qingming', '谷雨': 'guyu', '立夏': 'lixia', '小满': 'xiaoman',
  '芒种': 'mangzhong', '夏至': 'xiazhi', '小暑': 'xiaoshu', '大暑': 'dashu',
  '立秋': 'liqiu', '处暑': 'chushu', '白露': 'bailu', '秋分': 'qiufen',
  '寒露': 'hanlu', '霜降': 'shuangjiang', '立冬': 'lidong', '小雪': 'xiaoxue',
  '大雪': 'daxue', '冬至': 'dongzhi', '小寒': 'xiaohan', '大寒': 'dahan'
}

// 2. 计算当前应该显示的背景图片路径
const currentBgUrl = computed(() => {
  const termName = currentSolarTerm.value; // 获取当前节气中文，如"立春"
  const pinyin = solarTermMap[termName];
  
  if (pinyin) {
    // Vite 环境下动态引入本地图片的标准写法
    return new URL(`./assets/SolarTerm/${pinyin}.png`, import.meta.url).href;
  }
  
  // 兜底方案：如果没匹配到，返回默认背景
  return new URL('./assets/initial_background.png', import.meta.url).href;
})

// ================= 生命周期 =================
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
    <div
      class="pet-container"
      :class="{ 'floating-mode': isFloatingMode }"
      style="-webkit-app-region: drag;"
      :style="isFloatingMode ? {} : { transform: `translate(-50%, -50%) scale(${uiScale})` }"
    >

      <!-- 右上角圆形窗口控制已移除，保留键位和托盘控制通过其它 UI 入口 -->
    
      <div
        v-show="!isFloatingMode"
        class="stats-box"
        style="-webkit-app-region: no-drag;"
      >
        <div class="stats-header" @click="toggleStats">
          <span class="stats-title">实时状态</span>
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
          <img
            class="cat-image"
            src="./assets/cat.png"
            :style="isFloatingMode ? '-webkit-app-region: drag; pointer-events: auto;' : ''"
          />
          <img
            v-show="!isFloatingMode"
            class="plant-image"
            src="./assets/plant.png"
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

/* 悬浮模式时隐藏 viewport-root 的背景 */
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

/* 悬浮模式下：透明背景，自适应内容，允许滚动条 */
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
  top: 13% !important;               /* 可微调 */
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
  width: 280px;   /* 与窗口一致 */
  height: 400px;
}

/* 自定义窗口按钮 */
.window-controls {
  position: absolute;
  top: 14px;
  right: 20px;
  display: flex;
  gap: 8px;
  z-index: 6;
}

.window-btn {
  width: 30px;
  height: 30px;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(84, 78, 62, 0.45);
  border-radius: 50%;
  background: rgba(252, 248, 236, 0.85);
  color: #5a4730;
  font-size: 17px;
  font-family: "Microsoft YaHei", sans-serif;
  line-height: 1;
  cursor: pointer;
  transition: transform 0.12s ease, background-color 0.12s ease;
}

.window-btn-minimize {
  transform: translateY(-1px);
}

.minimize-glyph {
  display: block;
  width: 15px;
  height: 2px;
  border-radius: 999px;
  background: currentColor;
}

.window-btn:hover {
  background: rgba(252, 248, 236, 0.98);
  transform: translateY(-1px);
}

.window-btn:active {
  transform: translateY(1px);
}

.window-btn-minimize:hover {
  transform: translateY(-2px);
}

.window-btn-minimize:active {
  transform: translateY(0);
}

.window-btn.close:hover {
  background: rgba(238, 87, 87, 0.9);
  color: #fff;
  border-color: rgba(170, 45, 45, 0.75);
}

/* 统计面板容器 */
.stats-box {
  position: absolute;
  top: 30px;
  left: 78%;
  transform: translateX(-50%);
  width: 310px;
  height: 400px;
  overflow: visible;
  transition: all 0.2s ease;
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
  cursor: pointer;
}

.stats-title {
  font-size: 25px;
  font-weight: 400;
  color: #f3efe5;
  letter-spacing: 1px;
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

/* 状态栏 */
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
  /*top: 69%;*/
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
  display: flex;
  align-items: flex-end;
  pointer-events: auto;
}

.cat-image {
  width: 250px;
  filter: drop-shadow(0px 10px 10px rgba(0,0,0,0.5));
  transition: transform 0.2s;
}
.cat-image:hover {
  transform: scale(1.1);
}
.plant-image {
  width: 95px;
  margin-left: -24px;
  margin-bottom: 8px;
}

/* 操作按钮区 */
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
</style>

<style>
/* 悬浮时全局透明 */
html.floating,
body.floating {
  background: transparent !important;
  margin: 0 !important;
  padding: 0 !important;
  width: 100% !important;
  height: 100% !important;
}
</style>