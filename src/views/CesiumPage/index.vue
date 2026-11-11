<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { createCesiumResourceManager } from '@/cesium/CesiumResourceManager'
import { useMapStore } from '@/stores/map'
import huanggangBoundary from '../../../statics/黄冈市.json'
import { useCesiumViewer } from './useCesiumViewer'
import { deviceMethods, devices, renderDeviceIcons } from './deviceIcons'
import { createProgressiveLoader, DEFAULT_LOAD_TEST_PARAMS } from './loadTest'
import DeviceMethodPanel from './compones/DeviceMethodPanel.vue'
import LoadTestPanel from './compones/LoadTestPanel.vue'
import MapStatusPanel from './compones/MapStatusPanel.vue'

const container = ref(null)
const store = useMapStore()
const resources = createCesiumResourceManager(null, { exclusive: true })
let loader = null
onBeforeUnmount(() => {
  loader?.cancel()
  loader = null
  resources.dispose()
})

const { viewer, error, init } = useCesiumViewer(container)
watch(viewer, (instance) => resources.bindViewer(instance), { flush: 'sync' })

const activeMethod = ref('entity')
const loadStats = ref(null)

function startTest(params) {
  if (loader) loader.destroy()
  const instance = viewer.value
  if (!instance) return
  loader = createProgressiveLoader({
    viewer: instance,
    manager: resources,
    params,
    onProgress: (stats) => {
      loadStats.value = stats
    },
  })
  resources.setGroupEnabled('loadTest', true)
}

function stopTest() {
  loader?.cancel()
}

function clearTest() {
  loader?.destroy()
  loader = null
  loadStats.value = null
}

onMounted(() => {
  init()
  // 默认展示 statics/黄冈市.json 边界；上传页解析出的边界优先
  if (!store.hasBoundary) store.setBoundaryData(huanggangBoundary)

  renderDeviceIcons(resources, container.value)
  resources.switchTo(activeMethod.value)
  // 首屏自动跑一次 1w 点位的分帧逐级加载
  startTest(DEFAULT_LOAD_TEST_PARAMS)
})

function changeMethod(method) {
  activeMethod.value = method
  resources.switchTo(method)
  if (loader) resources.setGroupEnabled('loadTest', true)
}
</script>

<template>
  <section class="view cesium-page">
    <div ref="container" class="cesium-page__canvas"></div>
    <MapStatusPanel :viewer="viewer" :error="error" />
    <aside class="cesium-page__side">
      <DeviceMethodPanel
        :methods="deviceMethods"
        :active="activeMethod"
        :count="devices.length"
        @change="changeMethod"
      />
      <LoadTestPanel
        :stats="loadStats"
        @start="startTest"
        @stop="stopTest"
        @clear="clearTest"
      />
    </aside>
  </section>
</template>

<style lang="scss" scoped>
@use '../../styles/variables' as *;

.cesium-page {
  overflow: hidden;

  &__canvas {
    position: absolute;
    inset: 0;
  }

  &__side {
    position: absolute;
    z-index: 2;
    top: 16px;
    right: 16px;
    bottom: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    width: 300px;
    padding-right: 2px;
    overflow-y: auto;
    scrollbar-width: thin;
    pointer-events: none;
  }
}

@media (max-width: 900px) {
  .cesium-page__side {
    top: auto;
    right: 16px;
    bottom: 16px;
    left: 16px;
    width: auto;
    max-height: 45%;
  }
}
</style>
