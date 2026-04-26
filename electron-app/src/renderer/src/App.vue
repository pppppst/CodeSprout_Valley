<script setup>
import { ref, computed } from 'vue'

// 核心数据
const codeLines = ref(150)
const catExp = ref(0)
const message = ref('🐱 睡觉中...')

// 统计数据
const feedCount = ref(0)
const waterCount = ref(0)
const isStatsVisible = ref(true) // 统计面板折叠状态

// --- 核心功能函数 ---
// 喂猫粮
function feedCat() {
  catExp.value += 10
  feedCount.value++
  message.value = '😺 吧唧吧唧...好吃！(溢出经验+10)'
  setTimeout(() => message.value = '🐱 睡觉中...', 2000)
}

// 浇水
function waterPlant() {
  waterCount.value++
  message.value = '🌱 咕噜咕噜...水好甜！'
  setTimeout(() => message.value = '🐱 睡觉中...', 2000)
}

// 打开图鉴
function openGallery() {
  message.value = '📖 正在打开节气图鉴...'
  setTimeout(() => message.value = '🐱 睡觉中...', 2000)
}

// 切换统计面板折叠（修复AI的BUG！）
function toggleStats() {
  isStatsVisible.value = !isStatsVisible.value
}

// 进度条计算属性
const activeGridCount = computed(() => {
  return Math.min(Math.floor(codeLines.value / 100), 5)
})
</script>

<template>
  <div class="pet-container" style="-webkit-app-region: drag;">
    
    <!-- 左上角可折叠统计面板 -->
  <div 
    class="stats-box" 
    :class="{ 'stats-expanded': isStatsVisible }"
    style="-webkit-app-region: no-drag;"
  >
    <div class="stats-header" @click="toggleStats">
      <span>📊 实时状态</span>
      <span>{{ isStatsVisible ? '▲' : '▼' }}</span>
    </div>
    
    <div v-show="isStatsVisible" class="stats-content">
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
      </div>
    </div>
  </div>

    <!-- 状态栏替换为日期+节气 -->
    <div class="status-bar">
      <h3>📅 {{ currentDate }} · {{ currentSolarTerm }}</h3>
    </div>

    <!-- 宠物展示区 -->
    <div class="pet-area">
      <div class="bubble">{{ message }}</div>
      <div class="characters">
        <img class="cat-image" src="./assets/cat.png">
        <img class="plant-image" src="./assets/plant.png" >
      </div>
    </div>

    <!-- 操作按钮区 -->
    <div class="action-panel" style="-webkit-app-region: no-drag;">
      <button @click="feedCat">🍖 喂猫粮</button>
      <button @click="waterPlant">💧 浇水</button>
      <button @click="openGallery">📚 赛博图鉴</button>
    </div>
    
  </div>
</template>

<style scoped>
.pet-container {
  width: 100vw;
  height: 100vh;
  position: relative; 
  display: flex;
  flex-direction: column;
  align-items: center;
  background-image: url('./assets/initial_background.png');
  background-size: cover;
  background-position: center;
  color: white;
  border-radius: 20px;
  font-family: "思源黑体", "Microsoft YaHei", "更纱黑体", sans-serif;
  font-size: 15px;
  overflow: hidden;
}

/* 统计面板容器（折叠时完全透明，无背景无框） */
.stats-box {
  position: absolute;
  top: 20px;
  left: 20px;
  width: 220px; /* 恢复合理宽度，不要440px那么宽 */
  border-radius: 12px;
  overflow: hidden;
  transition: all 0.2s ease; /* 平滑过渡动画 */
}

/* ✅ 核心修复：只有展开时才显示磨砂背景和边框 */
.stats-expanded {
  background: rgba(255, 255, 255, 0.15);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  border: 1px solid rgba(255, 255, 255, 0.25);
}

/* 标题栏（折叠时完全透明，只显示文字） */
.stats-header {
  padding: 10px 15px;
  display: flex;
  justify-content: space-between;
  cursor: pointer;
  font-weight: bold;
  color: #2c5e2c;
  transition: background 0.2s ease;
}

/* 展开时标题栏才有轻微背景 */
.stats-expanded .stats-header {
  background: rgba(100, 150, 100, 0.2);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
}

.stats-content {
  padding: 15px;
}

/* 进度条样式 */
.progress-bar {
  display: flex;
  gap: 4px;
  margin-top: 8px;
  height: 12px;
}
.grid {
  flex: 1;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 2px;
}
.grid.active {
  background: #4CAF50;
  box-shadow: 0 0 8px #4CAF50;
}
.stat-detail p {
  margin: 10px 0 0 0;
  font-size: 14px;
  color: #000000;
}

.stat-item span{
  color: #000000;
  font-size: 14px;
}
/* 状态栏样式（青黛国风） */
.status-bar {
  margin-top: 30px;
  background: rgba(44, 94, 44, 0.15); /* 淡青黛背景 */
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  padding: 8px 24px;
  border-radius: 20px;
  border: 1px solid rgba(100, 150, 100, 0.25);
}

/* 宠物区域 */
.pet-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}
.bubble {
  background: rgba(255, 255, 255, 0.95);
  color: #333;
  padding: 12px 20px;
  border-radius: 20px;
  font-weight: bold;
  font-size: 18px;
  margin-bottom: 20px;
  box-shadow: 0 4px 6px rgba(0,0,0,0.1);
}

/* 宠物图片（你的优化效果：鼠标放大） */
.cat-image {
  width: 180px; 
  filter: drop-shadow(0px 10px 10px rgba(0,0,0,0.5));
  transition: transform 0.2s;
}
.cat-image:hover {
  transform: scale(1.1); /* 鼠标悬浮放大 */
}
.plant-image {
  width: 80px;
  margin-left: -30px;
}

/* 按钮面板（你的优化大按钮样式） */
.action-panel {
  position: absolute; 
  top: 80px;
  right: 20px;
  display: flex;
  flex-direction: column;
  gap: 15px;
}
button {
  width: 160px;
  padding: 12px 0;
  font-size: 20px;
  font-weight: bold;
  background-color: #4a7c59;
  color: #f9fff5;
  border: 3px solid #365d42;
  border-radius: 4px;
  cursor: pointer;
  box-shadow: 0 4px 0 #25422d;
  transition: all 0.1s;
}
button:hover {
  background-color: #5a9469;
}
button:active {
  transform: translateY(4px);
  box-shadow: 0 0 0 #365d42;
}
</style>