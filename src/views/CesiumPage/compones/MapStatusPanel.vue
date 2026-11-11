<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import * as Cesium from 'cesium'
import { defaultBaseLayer, tianditu, tiandituBaseLayers } from '@/config/map'
import { useMapStore } from '@/stores/map'

const props = defineProps({
  viewer: { type: Object, default: null },
  error: { type: String, default: '' },
  title: { type: String, default: 'Cesium 地图边界' },
  desc: { type: String, default: '默认加载天地图卫星影像底图（img + cia 注记），可切换矢量底图。' },
  boundaryHint: { type: String, default: '等待 shp 数据' },
})

const { hasBoundary } = storeToRefs(useMapStore())
const activeBase = ref('') // 'vec' | 'img' | ''
const showLabel = ref(true)
const layerError = ref('')
let baseLayer = null
let labelLayer = null

const activeLayerName = computed(
  () => tiandituBaseLayers.find((item) => item.id === activeBase.value)?.name ?? '',
)

const baseStatus = computed(() => {
  if (activeBase.value) {
    return `天地图${activeLayerName.value} + ${showLabel.value ? '注记' : '无注记'}`
  }
  return tianditu.ready ? '未加载' : '未加载（缺少 key）'
})

function createProvider(url) {
  return new Cesium.UrlTemplateImageryProvider({
    url,
    subdomains: tianditu.subdomains,
    tilingScheme: new Cesium.WebMercatorTilingScheme(),
    maximumLevel: 18,
    credit: '天地图',
  })
}

function getLayers() {
  const instance = props.viewer
  return instance && !instance.isDestroyed() ? instance.imageryLayers : null
}

function removeLayers() {
  const layers = getLayers()
  if (!layers) return
  if (baseLayer) {
    layers.remove(baseLayer, true)
    baseLayer = null
  }
  if (labelLayer) {
    layers.remove(labelLayer, true)
    labelLayer = null
  }
}

function syncLabelLayer() {
  const layers = getLayers()
  if (!layers) return
  if (labelLayer) {
    layers.remove(labelLayer, true)
    labelLayer = null
  }
  if (!showLabel.value || !activeBase.value) return

  const option = tiandituBaseLayers.find((item) => item.id === activeBase.value)
  if (!option) return
  labelLayer = layers.addImageryProvider(createProvider(tianditu.layers[option.label]))
}

function loadBaseLayer(type = defaultBaseLayer) {
  if (!tianditu.ready) {
    layerError.value = '未配置天地图 key，请在 src/config/map.local.js 或 .env.local 中填写'
    return
  }
  const layers = getLayers()
  if (!layers) {
    layerError.value = 'Cesium Viewer 尚未就绪'
    return
  }

  try {
    layerError.value = ''
    removeLayers()
    const option = tiandituBaseLayers.find((item) => item.id === type) ?? tiandituBaseLayers[0]
    // 天地图影像底图与注记地址都由 src/config/map.js 根据本地 key 生成
    baseLayer = layers.addImageryProvider(createProvider(tianditu.layers[option.base]))
    activeBase.value = option.id
    syncLabelLayer()
  } catch (e) {
    activeBase.value = ''
    layerError.value = e instanceof Error ? e.message : String(e)
  }
}

function toggleLabel() {
  showLabel.value = !showLabel.value
  syncLabelLayer()
}

// Viewer 就绪后自动加载天地图卫星影像底图（img）+ 影像注记（cia）
watch(
  () => props.viewer,
  (instance) => {
    if (instance && tianditu.ready) loadBaseLayer()
  },
  { immediate: true },
)

onBeforeUnmount(removeLayers)
</script>

<template>
  <div class="map-status-panel">
    <h1 class="page-title">{{ title }}</h1>
    <p class="page-desc">{{ desc }}</p>

    <div class="map-status-panel__tags">
      <span class="tag" :class="activeBase ? 'tag--ok' : 'tag--warn'">
        底图：{{ baseStatus }}
      </span>
      <span class="tag" :class="hasBoundary ? 'tag--ok' : 'tag--warn'">
        边界：{{ hasBoundary ? '已加载' : boundaryHint }}
      </span>
    </div>

    <div class="map-status-panel__controls">
      <button
        v-for="option in tiandituBaseLayers"
        :key="option.id"
        type="button"
        :class="{ 'is-active': activeBase === option.id }"
        @click="loadBaseLayer(option.id)"
      >
        {{ option.name }}底图
      </button>
      <button type="button" :class="{ 'is-active': showLabel }" @click="toggleLabel">
        注记 {{ showLabel ? '开' : '关' }}
      </button>
      <button type="button" @click="loadBaseLayer(activeBase || defaultBaseLayer)">重新加载</button>
    </div>

    <p v-if="!tianditu.ready" class="map-status-panel__hint">
      未检测到 key：在 src/config/map.local.js 的 TIANDITU_KEY 或 .env.local 的
      VITE_TIANDITU_KEY 中填写后重启开发服务器。
    </p>
    <p v-if="layerError" class="map-status-panel__error">{{ layerError }}</p>
    <p v-if="error" class="map-status-panel__error">初始化失败：{{ error }}</p>
  </div>
</template>

<style lang="scss" scoped>
@use '../../../styles/variables' as *;
@use '../../../styles/mixins' as *;

.map-status-panel {
  @include panel;
  position: absolute;
  z-index: 2;
  top: 16px;
  left: 16px;
  width: min(360px, calc(100% - 32px));
  padding: 16px 18px;
  pointer-events: auto;

  .page-title {
    font-size: 18px;
  }

  .page-desc {
    font-size: 13px;
  }

  &__tags {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 12px;
  }

  &__controls {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 12px;

    button {
      padding: 6px 10px;
      border: 1px solid $color-border;
      border-radius: $radius-sm;
      background: $color-surface-alt;
      color: $color-text;
      font-size: 12px;

      &:hover {
        border-color: $color-primary;
      }

      &.is-active {
        border-color: rgba($color-primary, 0.6);
        color: $color-primary;
      }
    }
  }

  &__hint {
    margin: 12px 0 0;
    color: $color-muted;
    font-size: 12px;
    line-height: 1.6;
  }

  &__error {
    margin: 12px 0 0;
    color: $color-warn;
    font-size: 13px;
  }
}
</style>
