<template>
  <div class="progress-container">
    <div class="progress-label">
      距离下次掉落物资还差 <span>{{ 50 - (totalLines % 50) }}</span> 行
    </div>
    <div class="bar-bg">
      <div class="bar-fill" :style="{ width: progress + '%' }">
        <div class="slider-icon">🦗</div> </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  progress: Number,
  totalLines: Number
})
</script>

<style scoped>
.progress-container {
  width: 320px;
  margin: 20px auto;
}
.progress-label {
  font-size: 14px;
  color: #2F4F4F;
  margin-bottom: 8px;
  text-align: center;
  font-family: "KaiTi", "楷体", serif;
  font-weight: bold;
}
.progress-label span {
  color: #d4a017;
  font-size: 1.2em;
}
.bar-bg {
  height: 16px;
  background: rgba(143, 188, 143, 0.3);
  border-radius: 20px;
  border: 2px solid #8FBC8F;
  position: relative;
}
.bar-fill {
  height: 100%;
  background: linear-gradient(90deg, #98FB98, #2E8B57);
  border-radius: 15px;
  transition: width 0.4s cubic-bezier(0.34, 1.56, 0.64, 1); /* 带有Q弹效果的动画 */
  position: relative;
}
.slider-icon {
  position: absolute;
  right: -12px;
  top: -10px;
  font-size: 20px;
}
</style>