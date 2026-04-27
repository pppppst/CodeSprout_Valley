<template>
  <div class="resource-header">
    <div class="item">
      <span class="icon">🍱</span> 
      <span class="label">赛博猫粮:</span>
      <span class="count">{{ catFood }}</span>
    </div>
    <div class="item">
      <span class="icon">💧</span>
      <span class="label">节气水滴:</span>
      <span class="count">{{ waterDrops }}</span>
    </div>
    <div class="total">
      累计编码: <span>{{ totalLines }}</span> 行
    </div>
  </div>
</template>

<script setup>
defineProps({
  catFood: Number,
  waterDrops: Number,
  totalLines: Number
})
</script>

<style scoped>
.resource-header {
  display: flex;
  gap: 20px;
  background: rgba(250, 246, 235, 0.85); /* 米黄色背景 */
  padding: 12px 30px;
  border-radius: 50px;
  border: 2px solid #8FBC8F; /* 浅海绿色边框 */
  margin-bottom: 30px;
  font-family: "KaiTi", "楷体", serif;
  box-shadow: 0 4px 12px rgba(143, 188, 143, 0.2);
}
.item { 
  display: flex; 
  align-items: center; 
  gap: 8px; 
}
.label { color: #2F4F4F; font-weight: bold; }
.count { 
  font-weight: bold; 
  color: #d4a017; /* 柠檬黄数字 */
  font-size: 1.3em; 
}
.total { 
  margin-left: 20px; 
  color: #555; 
  font-size: 1em;
  display: flex;
  align-items: center;
}
.total span {
  font-weight: bold;
  color: #2E8B57;
  margin: 0 5px;
  font-size: 1.2em;
}
</style>