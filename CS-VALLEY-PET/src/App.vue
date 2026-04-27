<template>
  <div class="app-main-window" :style="{ backgroundImage: `url(${bgYardImage})` }">
    
    <div class="glass-dashboard">
      <div class="panel-title">🌿 CS Valley </div>
      
      <ResourceHeader :catFood="catFood" :waterDrops="waterDrops" :totalLines="totalLines" />
      <CucumberProgress :progress="progress" :totalLines="totalLines" />

      <div class="control-panel">
        <p class="control-tip">开发测试控制台</p>
        <div class="buttons">
          <button @click="addCode(10)" class="btn-code">写10行代码</button>
          <button @click="triggerError" class="btn-error">满屏报错</button>
          <button @click="feedCat" class="btn-feed" :disabled="catFood <= 0">喂食猫粮</button>
        </div>
      </div>
    </div>

    <div class="pet-stage">
      <div class="pet-anchor">
        <ChatBubble :text="chatMessage" :visible="showChat" />
        
        <div class="cat-scale-wrapper">
          <PetCanvas :state="petState" />
        </div>
      </div>
    </div>

  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import bgYardImage from './assets/bg-yard.png'
import ResourceHeader from './components/ResourceHeader.vue'
import ChatBubble from './components/ChatBubble.vue'
import PetCanvas from './components/PetCanvas.vue'
import CucumberProgress from './components/CucumberProgress.vue'

/* ================= 核心业务逻辑 (带本地保存) ================= */
const savedLines = localStorage.getItem('cs_totalLines')
const savedFood = localStorage.getItem('cs_catFood')
const savedDrops = localStorage.getItem('cs_waterDrops')

const totalLines = ref(savedLines !== null ? Number(savedLines) : 0)
const catFood = ref(savedFood !== null ? Number(savedFood) : 1)
const waterDrops = ref(savedDrops !== null ? Number(savedDrops) : 0)

watch([totalLines, catFood, waterDrops], () => {
  localStorage.setItem('cs_totalLines', totalLines.value)
  localStorage.setItem('cs_catFood', catFood.value)
  localStorage.setItem('cs_waterDrops', waterDrops.value)
})

const petState = ref('idle')
const chatMessage = ref('')
const showChat = ref(false)

let hideChatTimer = null
let idleTimer = null

const progress = computed(() => {
  return ((totalLines.value % 50) / 50) * 100
})

const triggerAction = (newState, message, duration = 4000) => {
  petState.value = newState
  if (message) {
    chatMessage.value = message
    showChat.value = true
    clearTimeout(hideChatTimer)
    hideChatTimer = setTimeout(() => {
      showChat.value = false
    }, duration)
  }
  
  clearTimeout(idleTimer)
  idleTimer = setTimeout(() => {
    petState.value = 'idle'
  }, duration + 3000)
}

const addCode = (lines) => {
  const previousMilestone = Math.floor(totalLines.value / 50)
  totalLines.value += lines
  const currentMilestone = Math.floor(totalLines.value / 50)

  if (currentMilestone > previousMilestone) {
    const earnAmount = currentMilestone - previousMilestone
    catFood.value += earnAmount
    waterDrops.value += earnAmount
    triggerAction('eating', `太棒了！突破50行，掉落赛博物资！`)
  } else {
    triggerAction('coding', '主银在努力敲代码！Bug退散！', 3000)
  }
}

const triggerError = () => {
  triggerAction('error', '喵呜！满屏红线！深呼吸，猫猫陪你找Bug...', 5000)
}

const feedCat = () => {
  if (catFood.value > 0) {
    catFood.value--
    triggerAction('eating', '嚼嚼嚼...真香！主银最好了！', 4000)
  }
}
</script>

<style scoped>
/* ========== 分层 UI 样式 ========== */

.app-main-window {
  width: 100vw;
  height: 100vh;
  background-size: cover;
  background-position: center bottom;
  background-repeat: no-repeat;
  position: relative;
  overflow: hidden;
  margin: 0;
  padding: 0;
}

.glass-dashboard {
  position: absolute;
  top: 40px;
  left: 50px;
  width: 340px;
  padding: 25px;
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.45); 
  backdrop-filter: blur(15px);
  -webkit-backdrop-filter: blur(15px);
  border: 1px solid rgba(255, 255, 255, 0.6);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
  z-index: 10;
}

.panel-title {
  font-family: "KaiTi", "楷体", serif;
  font-size: 1.5em;
  color: #2E8B57;
  font-weight: bold;
  margin-bottom: 20px;
  text-align: center;
}

.control-panel {
  margin-top: 30px;
  padding-top: 20px;
  border-top: 1px dashed rgba(46, 139, 87, 0.3);
}

.control-tip {
  font-size: 12px;
  color: #666;
  text-align: center;
  margin-bottom: 10px;
}

.buttons {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  justify-content: center;
}

button {
  padding: 8px 15px;
  border: none;
  border-radius: 8px;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.2s;
  color: white;
}
button:active { transform: scale(0.95); }
button:disabled { opacity: 0.5; cursor: not-allowed; }

.btn-code { background: #4caf50; }
.btn-error { background: #e57373; }
.btn-feed { background: #ffb300; color: #5d4037;}

/* ================== 宠物舞台锚点 ================== */
.pet-stage {
  position: absolute;
  bottom: 22%; 
  left: 50%;
  transform: translateX(-50%);
  z-index: 5;
}

/* 锚点盒子，提供定位基准 */
.pet-anchor {
  position: relative;
  width: 200px; 
  display: flex;
  flex-direction: column;
  align-items: center;
}

.cat-scale-wrapper {
  transform: scale(1.8);
  transform-origin: bottom center;
}

/* 【重点修复】：强制修改子组件 ChatBubble 的位置 */
/* 彻底把气泡往上抬，避开 1.8 倍的猫猫头部 */
:deep(.chat-bubble) {
  top: -240px !important; 
}
</style>

<style>
html, body, #app {
  margin: 0 !important;
  padding: 0 !important;
  width: 100% !important;
  height: 100% !important;
  min-height: 100% !important;
  background: transparent !important;
  overflow: hidden;
}
</style>