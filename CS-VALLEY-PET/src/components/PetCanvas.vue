<template>
  <div class="pet-canvas">
    <!-- 使用 Vue 内置的 Transition 组件，并绑定 state 作为 key -->
    <!-- 这样每次状态改变，Vue 就会执行平滑的淡入淡出过渡 -->
    <transition name="fade">
      <img 
        :key="state"
        :src="currentImage" 
        alt="【猫猫】" 
        class="cat-image" 
        :class="animationClass" 
      />
    </transition>
  </div>
</template>

<script setup>
import { computed } from 'vue'

// 导入你的 4 张精美状态图
import catIdle from '../assets/cat-idle.png'
import catCoding from '../assets/cat-coding.png'
import catError from '../assets/cat-error.png'
import catEating from '../assets/cat-eating.png'

const props = defineProps({
  state: {
    type: String,
    default: 'idle'
  }
})

// 1. 映射图片
const currentImage = computed(() => {
  const imageMap = {
    'idle': catIdle,
    'coding': catCoding,
    'error': catError,
    'eating': catEating
  }
  return imageMap[props.state] || imageMap['idle']
})

// 2. 映射专属的 CSS 动画
const animationClass = computed(() => {
  switch (props.state) {
    case 'coding': return 'pounce-animation';
    case 'error': return 'shake-animation';
    case 'eating': return 'chew-animation';
    case 'idle':
    default: return 'breathe-animation';
  }
})
</script>

<style scoped>
.pet-canvas {
  width: 200px;
  height: 200px;
  position: relative; /* 改为相对定位，作为图片重叠的锚点 */
  margin: 0 auto;
}

.cat-image {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  filter: drop-shadow(0 10px 10px rgba(0,0,0,0.15));
  transform-origin: bottom center;
  
  /* 【核心魔法】：将图片绝对定位到底部居中 */
  /* 这样新旧图片在切换时就会完美重叠，实现交叉渐变而不引起页面抖动 */
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  margin: 0 auto;
}

/* ================== 状态切换的淡入淡出过渡 ================== */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.4s ease; /* 0.4秒的融合过渡时间 */
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0; /* 离开时变透明，进入时从透明开始 */
}

/* ================== 4种专属动作动画 ================== */

/* 1. 待机：缓慢呼吸 */
.breathe-animation {
  animation: breathe 4s ease-in-out infinite; 
}
@keyframes breathe {
  0%, 100% { transform: scale(1, 1); }
  50%      { transform: scale(1.03, 0.97); } 
}

/* 2. 写代码：兴奋扑腾/跳跃 */
.pounce-animation {
  animation: pounce 1.2s ease-in-out infinite; 
}
@keyframes pounce {
  0%, 100% { transform: translateY(0) scale(1, 1); }
  50%      { transform: translateY(-15px) scale(0.98, 1.05); } 
}

/* 3. 报错：崩溃发抖 */
.shake-animation {
  animation: shake 0.3s ease-in-out infinite; 
}
@keyframes shake {
  0%, 100% { transform: translateX(0) rotate(0deg); }
  25%      { transform: translateX(-3px) rotate(-2deg); }
  75%      { transform: translateX(3px) rotate(2deg); }
}

/* 4. 吃东西：开心咀嚼 */
.chew-animation {
  animation: chew 1.2s ease-in-out infinite; 
}
@keyframes chew {
  0%, 100% { transform: scale(1, 1); }
  50%      { transform: scale(1.06, 0.92); } 
}
</style>