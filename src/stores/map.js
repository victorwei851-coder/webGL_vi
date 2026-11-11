import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { cameraFocusRange, defaultView } from '@/config/map'

function createId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function clamp(value, min, max) {
  const number = Number(value)
  if (!Number.isFinite(number)) return min
  return Math.min(max, Math.max(min, number))
}

// 地图数据的共享状态：Cesium 边界、three.js 板块、上传资源、中心点与相机焦距
export const useMapStore = defineStore('map', () => {
  const boundaryData = ref(null) // GeoJSON，供 Cesium 渲染边界
  const plates = ref([]) // 板块模型数据，供 three.js 深度渲染
  const assets = ref([]) // 上传登记的文件（含原始 File 对象与解析状态）
  const activeBoundaryId = ref(null) // 当前回显的边界文件
  const centerPoint = ref({ longitude: defaultView.longitude, latitude: defaultView.latitude })
  const focusDistance = ref(defaultView.height)

  const hasBoundary = computed(() => boundaryData.value !== null)
  const hasPlates = computed(() => plates.value.length > 0)

  function setBoundaryData(data) {
    boundaryData.value = data
  }

  function setPlates(data) {
    plates.value = Array.isArray(data) ? data : []
  }

  function setActiveBoundaryId(id) {
    activeBoundaryId.value = id
  }

  function addAssets(fileList) {
    const added = Array.from(fileList).map((file) => ({
      id: createId(),
      name: file.name,
      size: file.size,
      format: file.name.split('.').pop()?.toLowerCase() ?? '',
      status: 'pending',
      message: '待解析',
      file,
    }))
    assets.value.push(...added)
    return added
  }

  function updateAsset(id, patch) {
    const item = assets.value.find((asset) => asset.id === id)
    if (item) Object.assign(item, patch)
  }

  function removeAsset(id) {
    assets.value = assets.value.filter((item) => item.id !== id)
    if (activeBoundaryId.value === id) {
      activeBoundaryId.value = null
      boundaryData.value = null
    }
  }

  function clearAssets() {
    assets.value = []
    activeBoundaryId.value = null
    boundaryData.value = null
  }

  function setCenterPoint(point) {
    centerPoint.value = {
      longitude: clamp(point?.longitude, -180, 180),
      latitude: clamp(point?.latitude, -90, 90),
    }
  }

  function setFocusDistance(value) {
    focusDistance.value = clamp(value, cameraFocusRange.min, cameraFocusRange.max)
  }

  return {
    boundaryData,
    plates,
    assets,
    activeBoundaryId,
    centerPoint,
    focusDistance,
    hasBoundary,
    hasPlates,
    setBoundaryData,
    setPlates,
    setActiveBoundaryId,
    addAssets,
    updateAsset,
    removeAsset,
    clearAssets,
    setCenterPoint,
    setFocusDistance,
  }
})
