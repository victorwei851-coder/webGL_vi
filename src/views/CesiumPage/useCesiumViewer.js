import { onBeforeUnmount, ref, shallowRef, watch } from 'vue'
import { storeToRefs } from 'pinia'
import * as Cesium from 'cesium'
import { boundaryStyle, defaultView } from '@/config/map'
import { useMapStore } from '@/stores/map'

// 负责 Cesium Viewer 的生命周期与边界数据渲染
// 天地图底图由 compones/MapStatusPanel.vue 按 src/config/map.js 的配置加载
export function useCesiumViewer(containerRef) {
  const viewer = shallowRef(null)
  const error = ref('')
  const { boundaryData } = storeToRefs(useMapStore())
  let boundarySource = null
  let stopWatch = () => {}

  async function renderBoundary(geojson) {
    const instance = viewer.value
    if (!instance) return

    if (boundarySource) {
      instance.dataSources.remove(boundarySource, true)
      boundarySource = null
    }
    if (!geojson) return

    try {
      const boundaryColor = Cesium.Color.fromCssColorString(boundaryStyle.color)
      boundarySource = await Cesium.GeoJsonDataSource.load(geojson, {
        stroke: boundaryColor.withAlpha(boundaryStyle.strokeAlpha),
        strokeWidth: boundaryStyle.strokeWidth,
        fill: boundaryColor.withAlpha(boundaryStyle.fillAlpha),
        clampToGround: true,
      })
      await instance.dataSources.add(boundarySource)
      instance.flyTo(boundarySource)
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
    }
  }

  function init() {
    const container = containerRef.value
    if (!container) return

    try {
      const instance = new Cesium.Viewer(container, {
        // 不加载 ion / Bing 默认底图，天地图图层由状态面板添加
        baseLayer: false,
        baseLayerPicker: false,
        geocoder: false,
        homeButton: false,
        sceneModePicker: false,
        navigationHelpButton: false,
        animation: false,
        timeline: false,
        fullscreenButton: false,
        infoBox: false,
        selectionIndicator: false,
      })
      viewer.value = instance
      instance.scene.globe.baseColor = Cesium.Color.fromCssColorString('#0b1626')

      instance.camera.setView({
        destination: Cesium.Cartesian3.fromDegrees(
          defaultView.longitude,
          defaultView.latitude,
          defaultView.height,
        ),
      })

      // 上传的 shp 转换为 GeoJSON 写入 store 后，这里自动渲染边界
      stopWatch = watch(boundaryData, renderBoundary, { immediate: true })
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
    }
  }

  function dispose() {
    stopWatch()
    boundarySource = null
    if (viewer.value && !viewer.value.isDestroyed()) {
      viewer.value.destroy()
    }
    viewer.value = null
  }

  onBeforeUnmount(dispose)

  return { viewer, error, init, dispose }
}
