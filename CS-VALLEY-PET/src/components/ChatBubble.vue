<template>
  <div v-show="visible" class="chat-bubble">
    <div class="bubble-content">
      {{ displayedText }}
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'

const props = defineProps({
  text: String,
  visible: Boolean
})

const displayedText = ref('')
let typeInterval = null

watch(() => props.text, (newText) => {
  if (newText && props.visible) {
    displayedText.value = ''
    clearInterval(typeInterval)
    let i = 0
    typeInterval = setInterval(() => {
      if (i < newText.length) {
        displayedText.value += newText.charAt(i)
        i++
      } else {
        clearInterval(typeInterval)
      }
    }, 80) // 打字速度，数字越小越快
  }
})
</script>

<style scoped>
.chat-bubble {
  position: absolute;
  top: -70px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(250, 246, 235, 0.95);
  border: 2px solid #8FBC8F; 
  border-radius: 12px;
  padding: 12px 18px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  min-width: 150px;
  max-width: 250px;
  text-align: center;
  z-index: 10;
  font-family: "KaiTi", "楷体", serif;
  color: #2F4F4F;
  font-size: 15px;
  font-weight: bold;
  line-height: 1.4;
}
.chat-bubble::after {
  content: '';
  position: absolute;
  bottom: -10px;
  left: 50%;
  transform: translateX(-50%);
  border-width: 10px 10px 0;
  border-style: solid;
  border-color: #8FBC8F transparent transparent transparent;
}
</style>