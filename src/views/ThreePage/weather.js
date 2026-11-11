import * as THREE from 'three'

export const DEFAULT_WEATHER_OPTIONS = Object.freeze({
  type: 'clear',
  sunBrightness: 1.8,
  overcastBrightness: 0.9,
  rainSpeed: 1.4,
  snowSize: 0.26,
  snowSpeed: 0.6,
  fogDensity: 0.035,
  windStrength: 1,
  windDirection: 45,
})

export const weatherTypes = [
  { id: 'clear', label: '晴天' },
  { id: 'overcast', label: '阴天' },
  { id: 'rain', label: '雨天' },
  { id: 'snow', label: '雪天' },
  { id: 'fog', label: '雾天' },
]

const WEATHER_TINT = {
  clear: '#4cc9f0',
  overcast: '#8fa6c8',
  rain: '#7fb6ff',
  snow: '#dff1ff',
  fog: '#9fb3cc',
}

// 天气对模型表面的覆盖色与基础不透明度（雾天由浓度单独计算）
const SURFACE = {
  clear: { color: '#ffffff', opacity: 0 },
  overcast: { color: '#8fa6c8', opacity: 0.1 },
  rain: { color: '#5c9fd8', opacity: 0.16 },
  snow: { color: '#eaf6ff', opacity: 0.24 },
  fog: { color: '#9fb3cc', opacity: 0 },
}

const WALL_VERTEX_SHADER = `
  varying float vHeight;
  void main() {
    vHeight = uv.y;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const WALL_FRAGMENT_SHADER = `
  uniform float uTime;
  uniform float uIntensity;
  uniform vec3 uColor;
  varying float vHeight;
  void main() {
    float fade = pow(1.0 - vHeight, 2.0);
    float scan = 0.5 + 0.5 * sin(vHeight * 16.0 - uTime * 1.8);
    float glow = (fade * 0.5 + scan * 0.12) * uIntensity;
    gl_FragColor = vec4(uColor * glow, glow);
  }
`

const RAIN_COUNT = 1400
const SNOW_COUNT = 900

function buildWallGeometry(segments, height) {
  const positions = []
  const uvs = []
  for (const [a, b] of segments) {
    const vertices = [
      [a[0], 0, a[1], 0],
      [b[0], 0, b[1], 0],
      [b[0], height, b[1], 1],
      [a[0], 0, a[1], 0],
      [b[0], height, b[1], 1],
      [a[0], height, a[1], 1],
    ]
    for (const [x, y, z, v] of vertices) {
      positions.push(x, y, z)
      uvs.push(0.5, v)
    }
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  return geometry
}

function createRain(count, sample, height) {
  const positions = new Float32Array(count * 6)
  const drops = Array.from({ length: count }, () => {
    const spot = sample()
    return {
      x: spot.x,
      y: Math.random() * height,
      z: spot.z,
      speed: 0.7 + Math.random() * 0.6,
    }
  })
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  const material = new THREE.LineBasicMaterial({
    color: new THREE.Color('#8ec9ff'),
    transparent: true,
    opacity: 0.62,
    depthWrite: false,
  })
  const object = new THREE.LineSegments(geometry, material)
  object.frustumCulled = false
  object.visible = false
  return { object, geometry, material, drops, positions }
}

function loadSnowTexture(url) {
  // 未提供资源或 Node 环境下退化为纯色圆点，保持模块可独立验证
  if (!url || typeof document === 'undefined') return null
  const texture = new THREE.TextureLoader().load(url)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

function createSnow(count, sample, height, textureUrl) {
  const positions = new Float32Array(count * 3)
  const flakes = Array.from({ length: count }, () => {
    const spot = sample()
    return {
      x: spot.x,
      y: Math.random() * height,
      z: spot.z,
      speed: 0.6 + Math.random() * 0.8,
      phase: Math.random() * Math.PI * 2,
    }
  })
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  const snowTexture = loadSnowTexture(textureUrl)
  const material = new THREE.PointsMaterial({
    size: DEFAULT_WEATHER_OPTIONS.snowSize,
    color: new THREE.Color(snowTexture ? '#ffffff' : '#f2f8ff'),
    map: snowTexture,
    alphaTest: 0.02,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
    sizeAttenuation: true,
  })
  const object = new THREE.Points(geometry, material)
  object.frustumCulled = false
  object.visible = false
  return { object, geometry, material, flakes, positions }
}

/**
 * 天气只作用于模型：粒子裁剪在模型多边形内，雾/雨雪表现贴在模型表面，
 * 并用沿整体外轮廓拉伸的光墙 + 顶面轮廓线明确标出天气作用边界。
 */
export function createWeatherSystem({
  scene,
  ambient,
  sun,
  region,
  shapes = [],
  outlineSegments = [],
  size = 12,
  depth = 0.42,
  snowTextureUrl = '',
  options = {},
}) {
  const height = size * 0.55
  const sample = region?.sample ?? (() => ({
    x: (Math.random() - 0.5) * size,
    z: (Math.random() - 0.5) * size,
  }))
  const contains = region?.contains ?? (() => true)

  const weatherGroup = new THREE.Group()
  weatherGroup.name = 'weather-boundary'
  scene.add(weatherGroup)

  const rain = createRain(RAIN_COUNT, sample, height)
  const snow = createSnow(SNOW_COUNT, sample, height, snowTextureUrl)
  weatherGroup.add(rain.object, snow.object)

  const wallMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uIntensity: { value: 0.45 },
      uColor: { value: new THREE.Color(WEATHER_TINT.clear) },
    },
    vertexShader: WALL_VERTEX_SHADER,
    fragmentShader: WALL_FRAGMENT_SHADER,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  })
  const wall = new THREE.Mesh(buildWallGeometry(outlineSegments, height), wallMaterial)
  wall.renderOrder = 2
  weatherGroup.add(wall)

  const outlinePositions = []
  for (const [a, b] of outlineSegments) {
    outlinePositions.push(a[0], depth + 0.03, a[1], b[0], depth + 0.03, b[1])
  }
  const outlineGeometry = new THREE.BufferGeometry()
  outlineGeometry.setAttribute('position', new THREE.Float32BufferAttribute(outlinePositions, 3))
  const outlineMaterial = new THREE.LineBasicMaterial({
    color: new THREE.Color(WEATHER_TINT.clear),
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
  })
  const outline = new THREE.LineSegments(outlineGeometry, outlineMaterial)
  outline.renderOrder = 4
  weatherGroup.add(outline)

  // 贴合每个板块顶面的覆盖层：阴/雨/雪/雾只改变模型表面，不影响背景
  const surfaceMaterial = new THREE.MeshBasicMaterial({
    color: new THREE.Color(SURFACE.clear.color),
    transparent: true,
    opacity: 0,
    depthWrite: false,
    side: THREE.DoubleSide,
  })
  const surfaceGroup = new THREE.Group()
  for (const shape of shapes) {
    const geometry = new THREE.ShapeGeometry(shape)
    geometry.rotateX(-Math.PI / 2)
    const mesh = new THREE.Mesh(geometry, surfaceMaterial)
    mesh.position.y = depth + 0.02
    mesh.renderOrder = 1
    surfaceGroup.add(mesh)
  }
  surfaceGroup.visible = false
  weatherGroup.add(surfaceGroup)

  const state = {
    windX: 0,
    windZ: 0,
    rainSpeed: DEFAULT_WEATHER_OPTIONS.rainSpeed,
    snowSpeed: DEFAULT_WEATHER_OPTIONS.snowSpeed,
  }

  function apply(next = {}) {
    const cfg = { ...DEFAULT_WEATHER_OPTIONS, ...next }
    const type = weatherTypes.some((item) => item.id === cfg.type) ? cfg.type : 'clear'

    rain.object.visible = type === 'rain'
    snow.object.visible = type === 'snow'

    const brightness = type === 'clear'
      ? Number(cfg.sunBrightness)
      : Number(cfg.overcastBrightness) * (type === 'overcast' ? 1 : 0.9)
    ambient.intensity = type === 'clear' ? 0.4 + brightness * 0.28 : brightness * 0.85
    sun.intensity = type === 'clear' ? brightness : brightness * 0.2
    sun.color.set(type === 'clear' ? '#fff0cf' : '#b9cbe8')

    const tint = new THREE.Color(WEATHER_TINT[type])
    wallMaterial.uniforms.uColor.value.copy(tint)
    outlineMaterial.color.copy(tint)

    const fogDensity = Math.max(0, Number(cfg.fogDensity) || 0)
    const surfaceOpacity = type === 'fog'
      ? Math.min(0.72, fogDensity * 7)
      : SURFACE[type].opacity
    surfaceMaterial.color.set(SURFACE[type].color)
    surfaceMaterial.opacity = surfaceOpacity
    surfaceGroup.visible = surfaceOpacity > 0
    wallMaterial.uniforms.uIntensity.value = type === 'fog'
      ? 0.5 + fogDensity * 6
      : (type === 'clear' ? 0.45 : 1)

    snow.material.size = Number(cfg.snowSize)
    const angle = (Number(cfg.windDirection) || 0) * Math.PI / 180
    const strength = Number(cfg.windStrength) || 0
    state.windX = Math.cos(angle) * strength
    state.windZ = Math.sin(angle) * strength
    state.rainSpeed = Number(cfg.rainSpeed) || 0
    state.snowSpeed = Number(cfg.snowSpeed) || 0
  }

  function updateRain(dt) {
    const { drops, positions, geometry } = rain
    const length = 0.22 + state.rainSpeed * 0.08
    for (let i = 0; i < drops.length; i += 1) {
      const drop = drops[i]
      drop.y -= state.rainSpeed * drop.speed * dt * 8
      drop.x += state.windX * dt * 1.6
      drop.z += state.windZ * dt * 1.6
      // 落到地面或飘出模型范围，就从模型内部重新生成一滴
      if (drop.y < -0.3 || !contains(drop.x, drop.z)) {
        const spot = sample()
        drop.x = spot.x
        drop.z = spot.z
        drop.y = height
      }
      const p = i * 6
      positions[p] = drop.x
      positions[p + 1] = drop.y
      positions[p + 2] = drop.z
      positions[p + 3] = drop.x + state.windX * 0.35
      positions[p + 4] = drop.y - length
      positions[p + 5] = drop.z + state.windZ * 0.35
    }
    geometry.attributes.position.needsUpdate = true
  }

  function updateSnow(dt, elapsed) {
    const { flakes, positions, geometry } = snow
    for (let i = 0; i < flakes.length; i += 1) {
      const flake = flakes[i]
      flake.y -= state.snowSpeed * flake.speed * dt * 3
      flake.x += (state.windX * 0.5 + Math.sin(elapsed * 1.3 + flake.phase) * 0.12) * dt
      flake.z += (state.windZ * 0.5 + Math.cos(elapsed * 1.1 + flake.phase) * 0.12) * dt
      if (flake.y < -0.3 || !contains(flake.x, flake.z)) {
        const spot = sample()
        flake.x = spot.x
        flake.z = spot.z
        flake.y = height
      }
      const p = i * 3
      positions[p] = flake.x
      positions[p + 1] = flake.y
      positions[p + 2] = flake.z
    }
    geometry.attributes.position.needsUpdate = true
  }

  function update(dt, elapsed) {
    wallMaterial.uniforms.uTime.value = elapsed
    if (rain.object.visible) updateRain(dt)
    if (snow.object.visible) updateSnow(dt, elapsed)
  }

  function dispose() {
    scene.remove(weatherGroup)
    const geometries = new Set()
    const materials = new Set()
    const textures = new Set()
    weatherGroup.traverse((object) => {
      if (object.geometry) geometries.add(object.geometry)
      const list = Array.isArray(object.material) ? object.material : [object.material]
      list.filter(Boolean).forEach((material) => {
        materials.add(material)
        if (material.map) textures.add(material.map)
      })
    })
    textures.forEach((texture) => texture.dispose())
    geometries.forEach((geometry) => geometry.dispose())
    materials.forEach((material) => material.dispose())
    weatherGroup.clear()
  }

  apply(options)

  return { apply, update, dispose }
}
