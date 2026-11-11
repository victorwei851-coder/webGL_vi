<script setup>
import { onMounted, ref } from 'vue'
import MapStatusPanel from '@/views/CesiumPage/compones/MapStatusPanel.vue'
import { useMapStore } from '@/stores/map'
import { centerOfBounds, estimateFocusDistance, getGeoJsonBounds, parseBoundaryFiles } from './parseBoundary'
import { useCesiumViewer } from './useCesiumViewer'
import AssetList from './compones/AssetList.vue'
import FileDropzone from './compones/FileDropzone.vue'
import MapConfigPanel from './compones/MapConfigPanel.vue'

const mapContainer = ref(null)
const store = useMapStore()
const { viewer, error, picking, init, startPickCenter, stopPickCenter } = useCesiumViewer(mapContainer)
const parsedData = new Map()

async function addFiles(files) {
  const added = store.addAssets(files)
  const results = await parseBoundaryFiles(added)
  for (const result of results) {
    store.updateAsset(result.id, { status: result.status, message: result.message })
    if (result.status === 'ready') parsedData.set(result.id, result.data)
  }

  const firstReady = results.find((result) => result.status === 'ready')
  if (firstReady) showBoundary(firstReady.id)
}

function showBoundary(id) {
  const data = parsedData.get(id)
  if (!data) return
  store.setActiveBoundaryId(id)
  store.setBoundaryData(data)

  const bounds = getGeoJsonBounds(data)
  if (bounds) {
    store.setCenterPoint(centerOfBounds(bounds))
    store.setFocusDistance(estimateFocusDistance(bounds))
  }
}

function removeAsset(id) {
  parsedData.delete(id)
  store.removeAsset(id)
}

function clearAssets() {
  parsedData.clear()
  store.clearAssets()
}

onMounted(init)
</script>

<template>
  <section class="view upload-page">
    <div class="upload-page__map">
      <div ref="mapContainer" class="upload-page__canvas"></div>
      <MapStatusPanel
        :viewer="viewer"
        title="上传与地图配置"
        desc="底图使用天地图卫星影像（img + cia 注记），可切换矢量底图与注记。"
        boundary-hint="等待上传"
      />
    </div>

    <aside class="upload-page__panel">
      <header class="upload-page__header">
        <h1 class="page-title">上传管理</h1>
        <p class="page-desc">上传 shp / GeoJSON 后自动解析，在 Cesium 上回显边界并定位相机。</p>
      </header>

      <FileDropzone @select="addFiles" />
      <AssetList
        :assets="store.assets"
        :active-id="store.activeBoundaryId"
        @show="showBoundary"
        @remove="removeAsset"
        @clear="clearAssets"
      />
      <MapConfigPanel
        :picking="picking"
        :error="error"
        @pick="startPickCenter"
        @cancel-pick="stopPickCenter"
      />
    </aside>
  </section>
</template>

<style lang="scss" scoped>
@use '../../styles/variables' as *;

.upload-page {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 400px;
  min-height: 0;
  overflow: hidden;

  &__map {
    position: relative;
    min-width: 0;
    overflow: hidden;
  }

  &__canvas {
    position: absolute;
    inset: 0;
  }

  &__panel {
    min-height: 0;
    padding: 28px 20px 48px;
    border-left: 1px solid $color-border;
    background: rgba($color-surface, 0.55);
    overflow-y: auto;
    scrollbar-width: thin;
  }

  &__header {
    .page-title {
      font-size: 20px;
    }

    .page-desc {
      font-size: 13px;
    }
  }
}

@media (max-width: 900px) {
  .upload-page {
    grid-template-columns: 1fr;
    grid-template-rows: minmax(300px, 45%) minmax(0, 1fr);
  }

  .upload-page__panel {
    border-top: 1px solid $color-border;
    border-left: 0;
  }
}
</style>
