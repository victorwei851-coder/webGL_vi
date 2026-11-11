<script setup>
import { tianditu } from '@/config/map'
import { useMapStore } from '@/stores/map'
import FeatureCard from './compones/FeatureCard.vue'
import StatusGrid from './compones/StatusGrid.vue'

const store = useMapStore()

const features = [
  {
    to: '/cesium',
    index: '01',
    title: 'Cesium 地图边界',
    desc: '以天地图为底图，加载并高亮 shp 转换后的边界数据。',
    tags: ['Cesium', '天地图', 'GeoJSON'],
  },
  {
    to: '/three',
    index: '02',
    title: 'Three.js 板块模型',
    desc: '独立的 WebGL 场景，用于地图板块的立体与深度渲染。',
    tags: ['three.js', 'WebGL', 'OrbitControls'],
  },
  {
    to: '/upload',
    index: '03',
    title: '上传管理',
    desc: '登记 shp / geojson / kml / gpkg 等边界数据，解析流程后续接入。',
    tags: ['shp', 'geojson', 'kml'],
  },
]
</script>

<template>
  <section class="view view--scroll home">
    <div class="home__inner">
      <header class="home__hero">
        <span class="tag tag--ok">Vue 3 · Pinia · Router · Sass · Cesium · three.js</span>
        <h1 class="home__title">地图边界与板块模型可视化</h1>
        <p class="page-desc">
          默认主页。Cesium 负责地图底图与边界，three.js 负责板块的深度渲染，
          上传管理页负责登记你自己提供的 shp 等数据文件。
        </p>
      </header>

      <div class="home__grid">
        <FeatureCard v-for="feature in features" :key="feature.to" :feature="feature" />
      </div>

      <StatusGrid
        :key-ready="tianditu.ready"
        :boundary-ready="store.hasBoundary"
        :plates-ready="store.hasPlates"
        :asset-count="store.assets.length"
      />
    </div>
  </section>
</template>

<style lang="scss" scoped>
@use '../../styles/variables' as *;

.home__inner {
  max-width: 1100px;
  margin: 0 auto;
  padding: 48px 24px 64px;
}

.home__hero {
  margin-bottom: 36px;

  .home__title {
    margin: 18px 0 12px;
    font-size: 34px;
  }
}

.home__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 16px;
}
</style>
