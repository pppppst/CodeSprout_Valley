<template>
  <canvas ref="canvasRef" class="weather-canvas" v-show="type !== 'none'"></canvas>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'

const props = defineProps({
  type: {
    type: String,
    default: 'none' // 可选值：'rain', 'snow', 'none'
  }
})

const canvasRef = ref(null)
let ctx = null
let particles = []
let animationFrameId = null
let width = 0
let height = 0

// 初始化粒子
function initParticles() {
  particles = []
  // 【修改点 1 - 更密】：粒子数量提升至 800
  const count = props.type === 'rain' ? 800 : 200 
  for (let i = 0; i < count; i++) {
    particles.push({
      x: Math.random() * width,
      y: Math.random() * height,
      length: props.type === 'rain' ? Math.random() * 10 + 15 : 0, 
      radius: Math.random() * 2 + 1,
      speedY: props.type === 'rain' ? Math.random() * 4 + 6 : Math.random() * 1 + 1, 
      speedX: props.type === 'rain' ? -2.5 : Math.random() * 1 - 0.5, 
      // 【修改点 2 - 减弱反光】：降低透明度上限 (基础 0.2 + 随机 0~0.4)
      opacity: Math.random() * 0.4 + 0.2,
      angle: Math.random() * Math.PI * 2
    })
  }
}

// 绘制一帧
function draw() {
  ctx.clearRect(0, 0, width, height)

  particles.forEach(p => {
    ctx.beginPath()
    if (props.type === 'rain') {
      // 【修改点 3 - 减弱反光】：将 RGB 值调低至灰蓝色 (150, 165, 180)
      ctx.strokeStyle = `rgba(150, 165, 180, ${p.opacity})`
      // 【修改点 4 - 更细】：线条粗细降至 0.8
      ctx.lineWidth = 0.8 
      ctx.moveTo(p.x, p.y)
      ctx.lineTo(p.x + (p.speedX / p.speedY) * p.length, p.y + p.length)
      ctx.stroke()
    } else if (props.type === 'snow') {
      ctx.fillStyle = `rgba(255, 255, 255, ${p.opacity})`
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2)
      ctx.fill()
    }

    // 更新坐标
    p.y += p.speedY
    p.x += p.speedX
    
    // 如果是雪花，增加左右摇摆效果
    if (props.type === 'snow') {
      p.angle += 0.02
      p.x += Math.sin(p.angle) * 0.5
    }

    // 边界重置
    if (p.y > height) {
      p.y = -20
      p.x = Math.random() * width
    }
    if (p.x < 0 || p.x > width) {
      p.x = props.type === 'rain' && p.speedX < 0 ? width + 10 : Math.random() * width
    }
  })

  animationFrameId = requestAnimationFrame(draw)
}

function resizeCanvas() {
  if (!canvasRef.value) return
  width = window.innerWidth
  height = window.innerHeight
  canvasRef.value.width = width
  canvasRef.value.height = height
  initParticles()
}

// 监听天气类型变化，重新生成粒子
watch(() => props.type, (newVal) => {
  if (animationFrameId) cancelAnimationFrame(animationFrameId)
  if (newVal !== 'none') {
    initParticles()
    draw()
  } else {
    ctx.clearRect(0, 0, width, height)
  }
})

onMounted(() => {
  ctx = canvasRef.value.getContext('2d')
  window.addEventListener('resize', resizeCanvas)
  resizeCanvas()
  if (props.type !== 'none') {
    draw()
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', resizeCanvas)
  if (animationFrameId) cancelAnimationFrame(animationFrameId)
})
</script>

<style scoped>
.weather-canvas {
  position: absolute;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  /* 核心属性：鼠标事件穿透！保证不会挡住底下的喂猫、浇水按钮 */
  pointer-events: none; 
  z-index: 0; /* 放在背景之上，但在主面板(z-index: 3/4)之下 */
}
</style>