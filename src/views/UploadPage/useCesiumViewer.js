import { onBeforeUnmount, ref, shallowRef, watch } from 'vue'
import { storeToRefs } from 'pinia'
import * as Cesium from 'cesium'
import { boundaryStyle } from '@/config/map'
import { useMapStore } from '@/stores/map'

// UploadPage 的 Cesium 生命周期：边界回显、中心点打点、相机焦距
// 天地图底图由 MapStatusPanel.vue 按 src/config/map.js 的配置统一加载与切换
export function useCesiumViewer(containerRef) {
  const viewer = shallowRef(null)
  const error = ref('')
  const picking = ref(false)
  const store = useMapStore()
  const { boundaryData, centerPoint, focusDistance } = storeToRefs(store)
  let boundarySource = null
  let centerEntity = null
  let pickHandler = null
  const stopWatches = []

  function updateCamera() {
    const instance = viewer.value
    if (!instance || instance.isDestroyed()) return
    const { longitude, latitude } = store.centerPoint
    instance.camera.setView({
      destination: Cesium.Cartesian3.fromDegrees(longitude, latitude, store.focusDistance),
      orientation: { heading: 0, pitch: -Cesium.Math.PI_OVER_TWO, roll: 0 },
    })
  }

  function centerLabel() {
    const { longitude, latitude } = store.centerPoint
    return `${longitude.toFixed(4)}°, ${latitude.toFixed(4)}°`
  }

  function updateCenterEntity() {
    const instance = viewer.value
    if (!instance || instance.isDestroyed()) return
    const { longitude, latitude } = store.centerPoint
    const position = Cesium.Cartesian3.fromDegrees(longitude, latitude, 0)

    if (!centerEntity) {
      centerEntity = instance.entities.add({
        id: 'center-point',
        position,
        point: {
          pixelSize: 12,
          color: Cesium.Color.fromCssColorString('#f5b971'),
          outlineColor: Cesium.Color.WHITE,
          outlineWidth: 2,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
        label: {
          text: centerLabel(),
          font: '12px sans-serif',
          fillColor: Cesium.Color.WHITE,
          showBackground: true,
          backgroundColor: Cesium.Color.fromCssColorString('#0b1020').withAlpha(0.8),
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          pixelOffset: new Cesium.Cartesian2(0, -14),
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
      })
    } else {
      centerEntity.position = position
      centerEntity.label.text = centerLabel()
    }
  }

  async function renderBoundary(geojson) {
    const instance = viewer.value
    if (!instance || instance.isDestroyed()) return

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
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
    }
  }

  function stopPickCenter() {
    if (pickHandler) {
      pickHandler.destroy()
      pickHandler = null
    }
    const instance = viewer.value
    if (instance && !instance.isDestroyed()) {
      instance.scene.canvas.style.cursor = ''
    }
    picking.value = false
  }

  function startPickCenter() {
    const instance = viewer.value
    if (!instance || instance.isDestroyed()) return
    stopPickCenter()
    picking.value = true
    instance.scene.canvas.style.cursor = 'crosshair'

    pickHandler = new Cesium.ScreenSpaceEventHandler(instance.scene.canvas)
    pickHandler.setInputAction((movement) => {
      const cartesian = instance.camera.pickEllipsoid(
        movement.position,
        instance.scene.globe.ellipsoid,
      )
      if (!cartesian) return
      const cartographic = Cesium.Cartographic.fromCartesian(cartesian)
      store.setCenterPoint({
        longitude: Cesium.Math.toDegrees(cartographic.longitude),
        latitude: Cesium.Math.toDegrees(cartographic.latitude),
      })
      stopPickCenter()
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK)
  }

  function init() {
    const container = containerRef.value
    if (!container) return

    try {
      const instance = new Cesium.Viewer(container, {
        // 不加载 ion / Bing 默认底图，天地图图层由 MapStatusPanel 添加
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
      updateCenterEntity()
      updateCamera()

      stopWatches.push(
        watch(boundaryData, renderBoundary, { immediate: true }),
        watch(centerPoint, () => {
          updateCenterEntity()
          updateCamera()
        }),
        watch(focusDistance, updateCamera),
      )
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
    }
  }

  function dispose() {
    stopPickCenter()
    stopWatches.forEach((stop) => stop())
    stopWatches.length = 0
    boundarySource = null
    centerEntity = null
    if (viewer.value && !viewer.value.isDestroyed()) viewer.value.destroy()
    viewer.value = null
  }

  onBeforeUnmount(dispose)

  return { viewer, error, picking, init, dispose, startPickCenter, stopPickCenter }
}
