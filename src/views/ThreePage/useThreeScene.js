import { onBeforeUnmount, ref, shallowRef } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { boundaryStyle } from '@/config/map'
import { createBoundaryGroup } from './geoBoundary'
import { createWeatherSystem } from './weather'

// 负责 three.js 场景的生命周期、边界板块、光效与天气配置
export function useThreeScene(
  containerRef,
  geojson,
  options = {},
  weatherOptions = {},
  snowTextureUrl = '',
) {
  const scene = shallowRef(null)
  const ready = ref(false)
  const error = ref('')
  let camera = null
  let renderer = null
  let controls = null
  let resizeObserver = null
  let boundary = null
  let weatherSystem = null
  let clock = null
  let elapsed = 0

  function resize() {
    const container = containerRef.value
    if (!container || !renderer || !camera) return
    const width = container.clientWidth || 1
    const height = container.clientHeight || 1
    camera.aspect = width / height
    camera.updateProjectionMatrix()
    renderer.setSize(width, height)
  }

  // 配置可在 init 之前调用，因此所有资源都要判空
  function applyOptions(next = {}) {
    if (controls) {
      const speed = Number(next.rotationSpeed)
      controls.autoRotate = Boolean(next.autoRotate)
      controls.autoRotateSpeed = Number.isFinite(speed) ? speed * 2 : 2
      controls.enabled = next.interaction !== false
    }
    if (boundary) boundary.effectsGroup.visible = next.effects !== false
  }

  function applyWeather(next = {}) {
    weatherSystem?.apply(next)
  }

  function init() {
    const container = containerRef.value
    if (!container) return

    try {
      const width = container.clientWidth || 1
      const height = container.clientHeight || 1

      scene.value = new THREE.Scene()
      scene.value.background = new THREE.Color('#0b1626')

      camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000)

      renderer = new THREE.WebGLRenderer({ antialias: true })
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
      renderer.setSize(width, height)
      container.appendChild(renderer.domElement)

      controls = new OrbitControls(camera, renderer.domElement)
      controls.enableDamping = true

      const ambient = new THREE.AmbientLight(0xffffff, 1.1)
      const sun = new THREE.DirectionalLight(0xffffff, 2)
      sun.position.set(5, 10, 6)
      scene.value.add(ambient, sun)

      boundary = createBoundaryGroup(geojson, {
        edgeColor: boundaryStyle.color,
        strokeAlpha: boundaryStyle.strokeAlpha,
      })
      scene.value.add(boundary.group)

      const grid = new THREE.GridHelper(boundary.size * 1.6, 16, 0x2a3b5c, 0x1b2540)
      grid.position.y = -0.01
      grid.material.transparent = true
      grid.material.opacity = 0.45
      scene.value.add(grid)

      weatherSystem = createWeatherSystem({
        scene: scene.value,
        ambient,
        sun,
        region: boundary.region,
        shapes: boundary.shapes,
        outlineSegments: boundary.outlineSegments,
        size: boundary.size,
        depth: boundary.depth,
        snowTextureUrl,
        options: weatherOptions,
      })

      // 按数据尺寸与容器宽高比自适应初始视角，窄屏时拉远避免裁切
      const aspect = width / height
      const distance = boundary.size * 1.35 * Math.max(1, 1.15 / Math.max(aspect, 0.1))
      camera.position.set(0, distance * 0.6, distance * 0.8)
      controls.target.set(0, 0, 0)
      controls.minDistance = boundary.size * 0.25
      controls.maxDistance = distance * 4
      controls.maxPolarAngle = Math.PI * 0.45
      controls.update()
      applyOptions(options)

      resizeObserver = new ResizeObserver(resize)
      resizeObserver.observe(container)

      clock = new THREE.Clock()
      elapsed = 0
      renderer.setAnimationLoop(() => {
        const delta = Math.min(clock.getDelta(), 0.05)
        elapsed += delta
        if (boundary) {
          boundary.effectMaterials.flow.uniforms.uTime.value = elapsed
          boundary.effectMaterials.halo.uniforms.uTime.value = elapsed
        }
        weatherSystem?.update(delta, elapsed)
        controls.update()
        renderer.render(scene.value, camera)
      })
      ready.value = true
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
    }
  }

  function dispose() {
    resizeObserver?.disconnect()
    resizeObserver = null
    renderer?.setAnimationLoop(null)
    controls?.dispose()
    weatherSystem?.dispose()
    weatherSystem = null

    if (boundary) {
      scene.value?.remove(boundary.group)
      boundary.dispose()
      boundary = null
    }

    scene.value?.traverse((object) => {
      object.geometry?.dispose()
      const materials = Array.isArray(object.material) ? object.material : [object.material]
      materials.filter(Boolean).forEach((material) => {
        material.map?.dispose()
        material.dispose()
      })
    })
    scene.value?.clear()

    if (renderer) {
      renderer.dispose()
      renderer.domElement.remove()
    }

    clock = null
    elapsed = 0
    renderer = null
    controls = null
    camera = null
    scene.value = null
    ready.value = false
  }

  onBeforeUnmount(dispose)

  return { scene, ready, error, init, dispose, applyOptions, applyWeather }
}
