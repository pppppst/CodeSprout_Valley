<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'

// 核心数据
const codeLines = ref(150)
const catExp = ref(0)
const message = ref('🐱 睡觉中...')

// 统计数据
const feedCount = ref(0)
const waterCount = ref(0)
const foodStock = ref(20)
const waterStock = ref(20)

// --- 核心功能函数 ---
// 喂猫粮
function feedCat() {
  catExp.value += 10
  feedCount.value++
  foodStock.value = Math.max(foodStock.value - 10, 0)
  message.value = '😺 吧唧吧唧...好吃！(溢出经验+10)'
  setTimeout(() => message.value = '🐱 睡觉中...', 2000)
}

// 浇水
function waterPlant() {
  waterCount.value++
  waterStock.value = Math.max(waterStock.value - 10, 0)
  message.value = '🌱 咕噜咕噜...水好甜！'
  setTimeout(() => message.value = '🐱 睡觉中...', 2000)
}

// 打开图鉴
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

// 进度条计算属性
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

function updateUiScale() {
  const designWidth = 1365
  const designHeight = 768
  const scaleX = window.innerWidth / designWidth
  const scaleY = window.innerHeight / designHeight
  uiScale.value = Math.min(scaleX, scaleY)
}

const solarTermTable = [
  [{ day: 6, name: '小寒' }, { day: 20, name: '大寒' }],
  [{ day: 4, name: '立春' }, { day: 19, name: '雨水' }],
  [{ day: 6, name: '惊蛰' }, { day: 21, name: '春分' }],
  [{ day: 5, name: '清明' }, { day: 20, name: '谷雨' }],
  [{ day: 6, name: '立夏' }, { day: 21, name: '小满' }],
  [{ day: 6, name: '芒种' }, { day: 21, name: '夏至' }],
  [{ day: 7, name: '小暑' }, { day: 23, name: '大暑' }],
  [{ day: 7, name: '立秋' }, { day: 23, name: '处暑' }],
  [{ day: 7, name: '白露' }, { day: 23, name: '秋分' }],
  [{ day: 8, name: '寒露' }, { day: 23, name: '霜降' }],
  [{ day: 7, name: '立冬' }, { day: 22, name: '小雪' }],
  [{ day: 7, name: '大雪' }, { day: 22, name: '冬至' }]
]

function getSolarTerm(date) {
  const month = date.getMonth()
  const day = date.getDate()
  const [first, second] = solarTermTable[month]

  if (day >= second.day) return second.name
  if (day >= first.day) return first.name

  const prevMonth = (month + 11) % 12
  return solarTermTable[prevMonth][1].name
}

const currentDate = computed(() => {
  const year = now.value.getFullYear()
  const month = String(now.value.getMonth() + 1).padStart(2, '0')
  const day = String(now.value.getDate()).padStart(2, '0')
  return `${year}年${month}月${day}日`
})

const currentSolarTerm = computed(() => getSolarTerm(now.value))

onMounted(() => {
  updateUiScale()
  window.addEventListener('resize', updateUiScale)

  timerId = setInterval(() => {
    now.value = new Date()
  }, 60000)
})

onUnmounted(() => {
  window.removeEventListener('resize', updateUiScale)

  if (timerId) {
    clearInterval(timerId)
  }
})
</script>

<template>
  <div class="viewport-root">
    <div
      class="pet-container"
      style="-webkit-app-region: drag;"
      :style="{ transform: `translate(-50%, -50%) scale(${uiScale})` }"
    >

    <div class="window-controls" style="-webkit-app-region: no-drag;">
      <button class="window-btn window-btn-minimize" @click="minimizeWindow" aria-label="最小化">
        <span class="minimize-glyph" aria-hidden="true"></span>
      </button>
      <button class="window-btn" @click="hideToTray" aria-label="隐藏到状态栏">T</button>
      <button class="window-btn close" @click="closeWindow" aria-label="关闭">X</button>
    </div>
    
    <!-- 左上角可折叠统计面板 -->
  <div
    class="stats-box"
    style="-webkit-app-region: no-drag;"
  >
    <div class="stats-header">
      <span class="stats-title">实时状态</span>
    </div>
    
    <div class="stats-content">
      <!-- 原有内容不变 -->
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
        <p>🧺 剩余猫粮: {{ foodStock }}</p>
        <p>🚿 剩余水量: {{ waterStock }}</p>
      </div>
    </div>
  </div>

    <!-- 状态栏替换为日期+节气 -->
    <div class="status-bar">
      <h3> {{ currentDate }} · {{ currentSolarTerm }}</h3>
    </div>

    <!-- 宠物展示区 -->
    <div class="pet-area">
      <div class="bubble">{{ message }}</div>
      <div class="characters">
        <img class="cat-image" src="./assets/cat.png">

      </div>
    </div>

    <!-- 操作按钮区 -->
    <div class="action-panel" style="-webkit-app-region: no-drag;">
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
  background-image: url('./assets/initial_background.png');
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
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
  background-image: url('./assets/initial_background.png');
  background-size: cover;
  background-position: center;
  color: white;
  border-radius: 20px;
  font-family: "华文中宋", "Microsoft YaHei", "黑体", sans-serif;
  font-size: 15px;
  overflow: hidden;
  transform-origin: center center;
}

.pet-container,
.pet-container * {
  font-weight: 900;
}

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
  height: 300px;
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
  pointer-events: none;
}

.stats-title {
  font-size: 25px;
  font-weight: 400;
  color: #f3efe5;
  letter-spacing: px;
  text-shadow: 0 2px 3px rgba(40, 32, 18, 0.3);
}

.stats-content {
  position: absolute;
  top: 68px;
  left: 48px;
  right: 60px;
  bottom: 76px;
  padding: 0;
  color: #4a3f2f;
}

/* 进度条样式 */
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
/* 状态栏样式（青黛国风） */
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

/* 宠物区域 */
.pet-area {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 1;
}
.bubble {
  position: absolute;
  left: 43%;
  top: 69%;
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

/* 宠物图片（你的优化效果：鼠标放大） */
.cat-image {
  width: 250px;
  filter: drop-shadow(0px 10px 10px rgba(0,0,0,0.5));
  transition: transform 0.2s;
}
.cat-image:hover {
  transform: scale(1.1); /* 鼠标悬浮放大 */
}
.plant-image {
  width: 95px;
  margin-left: -24px;
  margin-bottom: 8px;
}

/* 按钮面板（你的优化大按钮样式） */
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

/* 只改这里就能单独调整两个新按钮尺寸 */
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