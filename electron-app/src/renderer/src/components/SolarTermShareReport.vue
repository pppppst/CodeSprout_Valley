<script setup>
import paperTextureUrl from '../assets/solar-term-report-paper.png'

const paperTextureCacheKey = '20260608-172317'
const paperTextureBackgroundUrl = `${paperTextureUrl}?v=${paperTextureCacheKey}`

const formatTitleSlogan = (slogan) => {
  const text = String(slogan || '').trim()
  return text ? `—— ${text}` : ''
}

defineProps({
  report: {
    type: Object,
    required: true
  }
})
</script>

<template>
  <article class="solar-term-share-report" :style="{ backgroundImage: `url(${paperTextureBackgroundUrl})` }">
    <header class="share-report-header">
      <p class="share-report-brand">CodeSprout Valley</p>
      <h1>{{ report.termName }} · 节气记录</h1>
      <p class="share-report-period">{{ report.periodText }}</p>
    </header>

    <main class="share-report-body">
      <p class="share-report-intro">这个节气里，</p>

      <section class="share-report-lines" aria-label="节气统计">
        <p>
          你新增了
          <strong>{{ report.codeAdded }}</strong>
          行有效代码，
        </p>
        <p>
          单日最多活跃
          <strong>{{ report.activeFileCount }}</strong>
          个文件，
        </p>
        <p>
          整个节气累计活跃
          <strong>{{ report.activeFileTotal }}</strong>
          个文件，
        </p>
        <p>
          单日最高完成
          <strong>{{ report.fixCount }}</strong>
          次问题修复，
        </p>
        <p>
          整个节气累计完成
          <strong>{{ report.fixTotal }}</strong>
          次问题修复，
        </p>
        <p>
          累计专注开发
          <strong class="duration">{{ report.durationText }}</strong>
          。
        </p>
      </section>

      <section class="share-report-title-section">
        <p class="share-report-section-label">获得称号</p>
        <h2>〔 {{ report.title }} 〕</h2>
        <p class="share-report-title-slogan">{{ formatTitleSlogan(report.titleSlogan) }}</p>
      </section>

      <section class="share-report-harvest-section">
        <p class="share-report-section-label">本节气收获</p>
        <ul v-if="report.plants.length" class="share-report-plants">
          <li v-for="plant in report.plants" :key="plant.name" class="share-report-plant-card">
            <div class="share-report-plant-image-wrap">
              <img
                v-if="plant.image"
                class="share-report-plant-image"
                :src="plant.image"
                :alt="plant.name"
                draggable="false"
              />
              <span v-else class="share-report-plant-placeholder">{{ plant.name.slice(0, 1) }}</span>
            </div>
            <div class="share-report-plant-text">
              <span>{{ plant.name }}</span>
              <strong>×{{ plant.count }}</strong>
            </div>
          </li>
        </ul>
        <p v-else class="share-report-empty-harvest">这个节气还没有归档植物收获。</p>
      </section>
    </main>

    <footer class="share-report-footer">
      <p>代码会继续生长，</p>
      <p>新的节气即将开始。</p>
    </footer>
  </article>
</template>

<style scoped>
.solar-term-share-report {
  position: relative;
  overflow: hidden;
  width: 1080px;
  height: 1920px;
  padding: 132px 118px 118px;
  background-color: #e7c891;
  background-position: center;
  background-size: cover;
  color: #4a321e;
  font-family: 'Source Han Serif SC', 'Noto Serif CJK SC', '思源宋体', 'Songti SC', 'SimSun', serif;
  letter-spacing: 0;
  box-sizing: border-box;
}

.solar-term-share-report::before {
  content: '';
  position: absolute;
  inset: 0;
  background:
    linear-gradient(180deg, rgba(255, 249, 229, 0.22), rgba(117, 73, 33, 0.05)),
    radial-gradient(circle at center 26%, rgba(255, 249, 222, 0.34), transparent 50%);
  pointer-events: none;
}

.solar-term-share-report > * {
  position: relative;
  z-index: 1;
}

.share-report-header {
  text-align: center;
}

.share-report-brand {
  margin: 0 0 28px;
  color: rgba(88, 62, 34, 0.68);
  font-family: 'Source Han Serif SC', 'Noto Serif CJK SC', '思源宋体', serif;
  font-size: 28px;
}

.share-report-header h1 {
  margin: 0;
  color: #3d2717;
  font-family: 'Alimama DongFangDaKai', '优设标题黑', 'YouSheBiaoTiHei', 'Source Han Serif SC',
    'Noto Serif CJK SC', '思源宋体', serif;
  font-size: 76px;
  font-weight: 800;
  line-height: 1.15;
}

.share-report-period {
  margin: 26px 0 0;
  color: rgba(84, 57, 30, 0.76);
  font-size: 28px;
}

.share-report-body {
  margin-top: 104px;
}

.share-report-intro,
.share-report-section-label,
.share-report-footer p {
  margin: 0;
  font-size: 42px;
  line-height: 1.7;
}

.share-report-lines {
  margin: 40px 0 0;
}

.share-report-lines p {
  margin: 0 0 12px;
  font-size: 39px;
  line-height: 1.58;
}

.share-report-lines strong {
  display: inline-block;
  min-width: 1.2em;
  color: #76511f;
  font-family: 'Source Han Serif SC', 'Noto Serif CJK SC', '思源宋体', 'Georgia', serif;
  font-size: 68px;
  font-weight: 700;
  line-height: 1;
  vertical-align: -0.08em;
}

.share-report-lines strong.duration {
  font-size: 58px;
}

.share-report-title-section {
  margin-top: 72px;
}

.share-report-title-section .share-report-section-label {
  text-align: left;
}

.share-report-title-section h2 {
  display: block;
  margin: 18px 0 14px;
  color: #3e2b18;
  font-family: 'Source Han Serif SC', 'Noto Serif CJK SC', '思源宋体', 'Songti SC', serif;
  font-size: 74px;
  font-weight: 700;
  line-height: 1.18;
  text-align: center;
}

.share-report-title-slogan {
  width: 780px;
  margin: 0 auto;
  color: rgba(70, 48, 28, 0.84);
  font-size: 40px;
  font-weight: 400;
  line-height: 1.55;
  text-align: left;
  white-space: pre-line;
}

.share-report-harvest-section {
  margin-top: 54px;
}

.share-report-harvest-section .share-report-section-label {
  font-size: 38px;
}

.share-report-plants {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 22px;
  margin: 24px 0 0;
  padding: 0;
  list-style: none;
}

.share-report-plant-card {
  display: flex;
  align-items: center;
  min-height: 164px;
  padding: 16px;
  color: #4c341f;
  box-sizing: border-box;
}

.share-report-plant-image-wrap {
  display: grid;
  flex: 0 0 auto;
  place-items: center;
  width: 120px;
  height: 120px;
  margin-right: 20px;
}

.share-report-plant-image {
  display: block;
  width: 116px;
  height: 116px;
  object-fit: contain;
}

.share-report-plant-placeholder {
  color: rgba(76, 49, 24, 0.72);
  font-size: 54px;
  font-weight: 700;
}

.share-report-plant-text {
  display: flex;
  flex: 1 1 auto;
  min-width: 0;
  align-items: baseline;
  gap: 10px;
}

.share-report-plant-text span {
  overflow-wrap: anywhere;
  font-size: 36px;
  line-height: 1.25;
}

.share-report-plant-text strong {
  flex: 0 0 auto;
  color: #735020;
  font-size: 42px;
  font-weight: 700;
  line-height: 1;
}

.share-report-empty-harvest {
  margin: 28px 0 0;
  color: rgba(70, 48, 28, 0.72);
  font-size: 34px;
  line-height: 1.6;
}

.share-report-footer {
  position: absolute;
  right: 118px;
  bottom: 112px;
  left: 118px;
}

.share-report-footer p {
  text-align: right;
}
</style>
