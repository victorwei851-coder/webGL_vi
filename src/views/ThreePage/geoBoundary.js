import * as THREE from 'three'

const DEG2RAD = Math.PI / 180
const LABEL_FONT = '600 30px "PingFang SC", "Microsoft YaHei", sans-serif'

// 去掉 GeoJSON 环里闭合用的重复末点，避免三角化出现零长度边
function cleanRing(ring) {
  const points = ring.filter((point) =>
    Array.isArray(point) && Number.isFinite(point[0]) && Number.isFinite(point[1]),
  )
  if (points.length > 1) {
    const first = points[0]
    const last = points[points.length - 1]
    if (first[0] === last[0] && first[1] === last[1]) points.pop()
  }
  return points
}

// 统一拆成板块：polygons[i] 的第一个环是外环，其余是内环（洞）
function collectFeatures(geojson) {
  if (!geojson) return []
  const entries = geojson.type === 'FeatureCollection' ? (geojson.features ?? []) : [geojson]

  const features = []
  for (const entry of entries) {
    const isFeature = entry?.type === 'Feature'
    const geometry = isFeature ? entry.geometry : entry
    const properties = isFeature ? (entry.properties ?? {}) : {}
    if (!geometry) continue

    let rawPolygons = []
    if (geometry.type === 'Polygon') rawPolygons = [geometry.coordinates]
    else if (geometry.type === 'MultiPolygon') rawPolygons = geometry.coordinates
    else continue

    const polygons = rawPolygons
      .map((rings) => (Array.isArray(rings) ? rings : []).map(cleanRing).filter((ring) => ring.length >= 3))
      .filter((rings) => rings.length > 0)
    if (!polygons.length) continue

    features.push({
      name: String(properties.name ?? `板块 ${features.length + 1}`),
      center: properties.centroid ?? properties.center ?? null,
      polygons,
    })
  }
  return features
}

function summarizeFeatures(features) {
  let minLng = Infinity
  let maxLng = -Infinity
  let minLat = Infinity
  let maxLat = -Infinity
  let polygonCount = 0
  let pointCount = 0

  for (const feature of features) {
    for (const rings of feature.polygons) {
      polygonCount += 1
      for (const ring of rings) {
        for (const [lng, lat] of ring) {
          minLng = Math.min(minLng, lng)
          maxLng = Math.max(maxLng, lng)
          minLat = Math.min(minLat, lat)
          maxLat = Math.max(maxLat, lat)
          pointCount += 1
        }
      }
    }
  }

  if (!pointCount) {
    return { featureCount: 0, polygonCount: 0, pointCount: 0, names: [], bounds: null }
  }

  return {
    featureCount: features.length,
    polygonCount,
    pointCount,
    names: features.map((feature) => feature.name),
    bounds: { minLng, maxLng, minLat, maxLat },
  }
}

// 供状态面板使用，不需要创建 WebGL 资源
export function summarizeGeoJson(geojson) {
  return summarizeFeatures(collectFeatures(geojson))
}

function ringCenter(ring) {
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  for (const [x, y] of ring) {
    minX = Math.min(minX, x)
    maxX = Math.max(maxX, x)
    minY = Math.min(minY, y)
    maxY = Math.max(maxY, y)
  }
  return [(minX + maxX) / 2, (minY + maxY) / 2]
}

// 沿边界弧长推进的流动光带：aDistance 是每个顶点的累计弧长
const FLOW_VERTEX_SHADER = `
  attribute float aDistance;
  varying float vDistance;
  void main() {
    vDistance = aDistance;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const FLOW_FRAGMENT_SHADER = `
  uniform float uTime;
  uniform float uSpeed;
  uniform float uWavelength;
  uniform vec3 uColor;
  varying float vDistance;
  void main() {
    float phase = fract(vDistance / uWavelength - uTime * uSpeed);
    float tail = pow(1.0 - phase, 12.0);
    float core = pow(1.0 - phase, 60.0);
    float glow = tail * 0.75 + core * 1.4;
    gl_FragColor = vec4(uColor * glow, 1.0);
  }
`

// 底部由内向外扩散的光环 + 中心柔光
const HALO_VERTEX_SHADER = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const HALO_FRAGMENT_SHADER = `
  uniform float uTime;
  uniform float uSpeed;
  uniform vec3 uColor;
  varying vec2 vUv;
  void main() {
    vec2 p = (vUv - 0.5) * 2.0;
    float d = length(p);
    float fade = 1.0 - smoothstep(0.3, 1.0, d);
    float wave = fract(d * 3.0 - uTime * uSpeed);
    float ring = pow(1.0 - wave, 18.0);
    float core = exp(-d * 5.0) * 0.45;
    float glow = (ring * 0.6 + core) * fade;
    gl_FragColor = vec4(uColor * glow, 1.0);
  }
`

function pointInRing(x, z, ring) {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const [xi, zi] = ring[i]
    const [xj, zj] = ring[j]
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside
  }
  return inside
}

function ringBounds(ring) {
  let minX = Infinity
  let maxX = -Infinity
  let minZ = Infinity
  let maxZ = -Infinity
  for (const [x, z] of ring) {
    minX = Math.min(minX, x)
    maxX = Math.max(maxX, x)
    minZ = Math.min(minZ, z)
    maxZ = Math.max(maxZ, z)
  }
  return { minX, maxX, minZ, maxZ }
}

// 把「是否在模型内」预计算成网格位掩码，天气粒子每帧查询为 O(1)
function buildRegion(worldPolygons, gridSize = 96) {
  const prepared = []
  let minX = Infinity
  let maxX = -Infinity
  let minZ = Infinity
  let maxZ = -Infinity

  for (const rings of worldPolygons) {
    const outer = rings[0]
    const bbox = ringBounds(outer)
    prepared.push({ outer, holes: rings.slice(1), bbox })
    minX = Math.min(minX, bbox.minX)
    maxX = Math.max(maxX, bbox.maxX)
    minZ = Math.min(minZ, bbox.minZ)
    maxZ = Math.max(maxZ, bbox.maxZ)
  }

  const stepX = Math.max(maxX - minX, 1e-6) / gridSize
  const stepZ = Math.max(maxZ - minZ, 1e-6) / gridSize
  const mask = new Uint8Array(gridSize * gridSize)
  const cells = []

  for (let iz = 0; iz < gridSize; iz += 1) {
    for (let ix = 0; ix < gridSize; ix += 1) {
      const x = minX + (ix + 0.5) * stepX
      const z = minZ + (iz + 0.5) * stepZ
      const hit = prepared.some(({ outer, holes, bbox }) => {
        if (x < bbox.minX || x > bbox.maxX || z < bbox.minZ || z > bbox.maxZ) return false
        if (!pointInRing(x, z, outer)) return false
        return !holes.some((hole) => pointInRing(x, z, hole))
      })
      if (hit) {
        mask[iz * gridSize + ix] = 1
        cells.push([x, z])
      }
    }
  }

  const fallback = [(minX + maxX) / 2, (minZ + maxZ) / 2]
  return {
    bounds: { minX, maxX, minZ, maxZ },
    cellCount: cells.length,
    contains(x, z) {
      const ix = Math.floor((x - minX) / stepX)
      const iz = Math.floor((z - minZ) / stepZ)
      if (ix < 0 || ix >= gridSize || iz < 0 || iz >= gridSize) return false
      return mask[iz * gridSize + ix] === 1
    },
    sample() {
      const cell = cells.length ? cells[Math.floor(Math.random() * cells.length)] : fallback
      return {
        x: cell[0] + (Math.random() - 0.5) * stepX,
        z: cell[1] + (Math.random() - 0.5) * stepZ,
      }
    },
  }
}

// 相邻区县共享的边会出现两次，只保留出现一次的边作为整体外轮廓
function collectOutline(worldPolygons) {
  const edges = new Map()
  for (const rings of worldPolygons) {
    const ring = rings[0]
    for (let i = 0; i < ring.length; i += 1) {
      const a = ring[i]
      const b = ring[(i + 1) % ring.length]
      const ka = `${a[0]},${a[1]}`
      const kb = `${b[0]},${b[1]}`
      const key = ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`
      const entry = edges.get(key)
      if (entry) entry.count += 1
      else edges.set(key, { a, b, count: 1 })
    }
  }
  return [...edges.values()].filter((edge) => edge.count === 1).map((edge) => [edge.a, edge.b])
}

function createLabel(text) {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  ctx.font = LABEL_FONT
  const width = Math.ceil(ctx.measureText(text).width) + 28
  const height = 46
  const ratio = Math.min(window.devicePixelRatio || 1, 2)
  canvas.width = Math.round(width * ratio)
  canvas.height = Math.round(height * ratio)
  ctx.scale(canvas.width / width, canvas.height / height)

  ctx.fillStyle = 'rgba(11, 16, 32, 0.82)'
  ctx.fillRect(0, 0, width, height)
  ctx.strokeStyle = 'rgba(76, 201, 240, 0.55)'
  ctx.strokeRect(0.5, 0.5, width - 1, height - 1)
  ctx.font = LABEL_FONT
  ctx.fillStyle = '#e8eefc'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, width / 2, height / 2 + 1)

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  })
  const sprite = new THREE.Sprite(material)
  sprite.scale.set(width / 90, height / 90, 1)
  sprite.renderOrder = 3
  return sprite
}

/**
 * 把 GeoJSON 面数据渲染成 XZ 平面上的立体板块（Y 为挤出高度）。
 * 经纬度以数据包围盒中心做等距近似投影，纬度按 cos(centerLat) 修正经度方向形变。
 */
export function createBoundaryGroup(geojson, options = {}) {
  const {
    targetSize = 12,
    depth = 0.42,
    edgeColor = '#4cc9f0',
    strokeAlpha = 1,
    showLabels = true,
  } = options

  const features = collectFeatures(geojson)
  const stats = summarizeFeatures(features)
  if (!stats.bounds) throw new Error('GeoJSON 中没有可渲染的面（Polygon / MultiPolygon）数据')

  const { minLng, maxLng, minLat, maxLat } = stats.bounds
  const centerLng = (minLng + maxLng) / 2
  const centerLat = (minLat + maxLat) / 2
  const cosLat = Math.cos(centerLat * DEG2RAD)
  const spanX = (maxLng - minLng) * cosLat
  const spanY = maxLat - minLat
  const scale = targetSize / Math.max(spanX, spanY, 1e-6)

  const project = ([lng, lat]) => new THREE.Vector2(
    (lng - centerLng) * cosLat * scale,
    (lat - centerLat) * scale,
  )
  // Shape 在 XY 平面挤出，rotateX(-90°) 后世界坐标为 (x, 高度, -y)
  const toWorld = (point, height) => new THREE.Vector3(point.x, height, -point.y)

  // 把每个环拆成连续线段，顶点附带沿环累计的弧长，供流动着色器取样
  const flowPositions = []
  const flowDistances = []
  const flowHeight = depth + 0.014
  let flowCursor = 0

  function pushFlowRing(ring) {
    const points = ring.map(project)
    for (let i = 0; i < points.length; i += 1) {
      const a = points[i]
      const b = points[(i + 1) % points.length]
      const ax = a.x
      const az = -a.y
      const bx = b.x
      const bz = -b.y
      const length = Math.hypot(bx - ax, bz - az)
      if (length < 1e-6) continue
      flowPositions.push(ax, flowHeight, az, bx, flowHeight, bz)
      flowDistances.push(flowCursor, flowCursor + length)
      flowCursor += length
    }
  }

  // 投影后的世界坐标多边形与 Shape，供天气系统裁剪粒子、贴合模型表面
  const worldPolygons = []
  const shapes = []

  const group = new THREE.Group()
  group.name = 'geo-boundary'
  const edgeMaterial = new THREE.LineBasicMaterial({
    color: new THREE.Color(edgeColor),
    transparent: true,
    opacity: strokeAlpha,
  })

  features.forEach((feature, index) => {
    const hue = 0.51 + (index % 10) * 0.013
    const faceColor = new THREE.Color().setHSL(hue, 0.6, 0.42)
    const topMaterial = new THREE.MeshStandardMaterial({
      color: faceColor,
      roughness: 0.55,
      metalness: 0.12,
      side: THREE.DoubleSide,
    })
    const sideMaterial = new THREE.MeshStandardMaterial({
      color: faceColor.clone().multiplyScalar(0.55),
      roughness: 0.75,
      metalness: 0.05,
      side: THREE.DoubleSide,
    })

    let labelCenter = null
    for (const rings of feature.polygons) {
      for (const ring of rings) pushFlowRing(ring)

      worldPolygons.push(rings.map((ring) => ring.map((point) => {
        const projected = project(point)
        return [projected.x, -projected.y]
      })))

      const shape = new THREE.Shape(rings[0].map(project))
      for (const hole of rings.slice(1)) shape.holes.push(new THREE.Path(hole.map(project)))
      shapes.push(shape)

      const geometry = new THREE.ExtrudeGeometry(shape, {
        depth,
        steps: 1,
        curveSegments: 1,
        bevelEnabled: false,
      })
      geometry.rotateX(-Math.PI / 2)

      const mesh = new THREE.Mesh(geometry, [topMaterial, sideMaterial])
      mesh.name = feature.name
      group.add(mesh)

      // EdgesGeometry 只保留硬边，正好勾出顶/底轮廓与侧面棱线
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geometry, 1), edgeMaterial)
      edges.position.y = 0.004
      edges.renderOrder = 1
      group.add(edges)

      if (!labelCenter) labelCenter = feature.center ?? ringCenter(rings[0])
    }

    if (showLabels && labelCenter) {
      const label = createLabel(feature.name)
      label.position.copy(toWorld(project(labelCenter), depth + 0.4))
      group.add(label)
    }
  })

  // 特效单独成组，方便通过 visible 一键开关
  const effectsGroup = new THREE.Group()
  effectsGroup.name = 'boundary-effects'

  const flowGeometry = new THREE.BufferGeometry()
  flowGeometry.setAttribute('position', new THREE.Float32BufferAttribute(flowPositions, 3))
  flowGeometry.setAttribute('aDistance', new THREE.Float32BufferAttribute(flowDistances, 1))
  const flowMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uSpeed: { value: 0.35 },
      uWavelength: { value: targetSize * 1.1 },
      uColor: { value: new THREE.Color('#a8f0ff') },
    },
    vertexShader: FLOW_VERTEX_SHADER,
    fragmentShader: FLOW_FRAGMENT_SHADER,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  })
  const flowLines = new THREE.LineSegments(flowGeometry, flowMaterial)
  flowLines.renderOrder = 2
  effectsGroup.add(flowLines)

  const haloMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uSpeed: { value: 0.28 },
      uColor: { value: new THREE.Color(edgeColor) },
    },
    vertexShader: HALO_VERTEX_SHADER,
    fragmentShader: HALO_FRAGMENT_SHADER,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  })
  const halo = new THREE.Mesh(
    new THREE.PlaneGeometry(targetSize * 2.1, targetSize * 2.1),
    haloMaterial,
  )
  halo.rotation.x = -Math.PI / 2
  halo.position.y = -0.06
  effectsGroup.add(halo)

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(targetSize * 0.74, targetSize * 0.755, 128),
    new THREE.MeshBasicMaterial({
      color: new THREE.Color(edgeColor),
      transparent: true,
      opacity: 0.4,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  )
  ring.rotation.x = -Math.PI / 2
  ring.position.y = -0.045
  effectsGroup.add(ring)

  group.add(effectsGroup)

  const region = buildRegion(worldPolygons)
  const outlineSegments = collectOutline(worldPolygons)

  return {
    group,
    effectsGroup,
    effectMaterials: { flow: flowMaterial, halo: haloMaterial },
    region,
    shapes,
    outlineSegments,
    stats,
    size: targetSize,
    depth,
    dispose: () => disposeBoundary(group, edgeMaterial),
  }
}

// 统一释放板块、描边与标签纹理；extraMaterial 用于兜底共享材质
export function disposeBoundary(group, extraMaterial = null) {
  if (!group) return
  const geometries = new Set()
  const materials = new Set()
  const textures = new Set()

  group.traverse((object) => {
    if (object.geometry) geometries.add(object.geometry)
    const list = Array.isArray(object.material) ? object.material : [object.material]
    list.filter(Boolean).forEach((material) => materials.add(material))
  })
  if (extraMaterial) materials.add(extraMaterial)

  for (const material of materials) {
    if (material.map) textures.add(material.map)
  }
  textures.forEach((texture) => texture.dispose())
  materials.forEach((material) => material.dispose())
  geometries.forEach((geometry) => geometry.dispose())
  group.clear()
}
