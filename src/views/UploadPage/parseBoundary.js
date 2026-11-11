import { cameraFocusRange } from '@/config/map'

const GEOMETRY_TYPES = new Set([
  'Point',
  'MultiPoint',
  'LineString',
  'MultiLineString',
  'Polygon',
  'MultiPolygon',
  'GeometryCollection',
])
const COMPANION_FORMATS = new Set(['shx', 'dbf', 'prj', 'cpg'])

function baseName(name) {
  return name.replace(/\.[^.]+$/, '').toLowerCase()
}

export function normalizeGeoJson(data) {
  if (!data || typeof data !== 'object') throw new Error('GeoJSON 内容无效')
  if (data.type === 'FeatureCollection' && Array.isArray(data.features)) return data
  if (data.type === 'Feature') return { type: 'FeatureCollection', features: [data] }
  if (GEOMETRY_TYPES.has(data.type)) {
    return { type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: data }] }
  }
  throw new Error(`不支持的 GeoJSON 类型：${data.type ?? '未知'}`)
}

// 轻量 Shapefile 读取：支持 Point / MultiPoint / PolyLine / Polygon 及其 Z、M 变体
export function parseShapefile(buffer) {
  const view = new DataView(buffer)
  if (view.byteLength < 100 || view.getInt32(0, false) !== 9994) {
    throw new Error('不是有效的 .shp 文件')
  }

  const features = []
  let offset = 100
  while (offset + 8 <= view.byteLength) {
    const contentBytes = view.getInt32(offset + 4, false) * 2
    const start = offset + 8
    if (contentBytes < 4 || start + contentBytes > view.byteLength) break

    const shapeType = view.getInt32(start, true)
    const geometry = readShape(view, start + 4, shapeType)
    if (geometry) features.push({ type: 'Feature', properties: {}, geometry })
    offset = start + contentBytes
  }

  if (!features.length) throw new Error('.shp 中没有可读取的几何要素')
  return { type: 'FeatureCollection', features }
}

function readShape(view, pos, rawType) {
  // 11/21 -> 1, 13/23 -> 3, 15/25 -> 5, 18/28 -> 8；MultiPatch(31) 不处理
  const kind = rawType > 10 && rawType <= 28 ? rawType % 10 : rawType

  if (kind === 1) {
    if (pos + 16 > view.byteLength) return null
    return {
      type: 'Point',
      coordinates: [view.getFloat64(pos, true), view.getFloat64(pos + 8, true)],
    }
  }

  if (kind === 8) {
    let cursor = pos + 32 // bbox: 4 个 double
    if (cursor + 4 > view.byteLength) return null
    const count = view.getInt32(cursor, true)
    cursor += 4
    const coordinates = []
    for (let i = 0; i < count; i += 1) {
      if (cursor + 16 > view.byteLength) break
      coordinates.push([view.getFloat64(cursor, true), view.getFloat64(cursor + 8, true)])
      cursor += 16
    }
    return coordinates.length ? { type: 'MultiPoint', coordinates } : null
  }

  if (kind !== 3 && kind !== 5) return null

  let cursor = pos + 32 // bbox: 4 个 double
  if (cursor + 8 > view.byteLength) return null
  const numParts = view.getInt32(cursor, true)
  cursor += 4
  const numPoints = view.getInt32(cursor, true)
  cursor += 4
  if (numParts < 1 || numPoints < 1) return null

  const parts = []
  for (let i = 0; i < numParts; i += 1) {
    if (cursor + 4 > view.byteLength) return null
    parts.push(view.getInt32(cursor, true))
    cursor += 4
  }

  const points = []
  for (let i = 0; i < numPoints; i += 1) {
    if (cursor + 16 > view.byteLength) break
    points.push([view.getFloat64(cursor, true), view.getFloat64(cursor + 8, true)])
    cursor += 16
  }

  const rings = parts.map((startIndex, index) =>
    points.slice(startIndex, parts[index + 1] ?? numPoints),
  )
  if (kind === 3) {
    return rings.length === 1
      ? { type: 'LineString', coordinates: rings[0] }
      : { type: 'MultiLineString', coordinates: rings }
  }
  return buildPolygon(rings)
}

function closeRing(ring) {
  if (ring.length < 3) return ring
  const first = ring[0]
  const last = ring[ring.length - 1]
  if (first[0] !== last[0] || first[1] !== last[1]) ring.push([...first])
  return ring
}

function ringArea(ring) {
  let sum = 0
  for (let i = 0; i < ring.length - 1; i += 1) {
    sum += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1]
  }
  return Math.abs(sum / 2)
}

function ringBBox(ring) {
  return ring.reduce(
    (box, [x, y]) => ({
      minX: Math.min(box.minX, x),
      minY: Math.min(box.minY, y),
      maxX: Math.max(box.maxX, x),
      maxY: Math.max(box.maxY, y),
    }),
    { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity },
  )
}

function bboxContains(outer, inner) {
  return (
    outer.minX <= inner.minX &&
    outer.minY <= inner.minY &&
    outer.maxX >= inner.maxX &&
    outer.maxY >= inner.maxY
  )
}

// 面积大的环作为外环，被其包围的小环作为孔洞
function buildPolygon(rings) {
  const closed = rings.filter((ring) => ring.length >= 3).map(closeRing)
  if (!closed.length) return null
  const sorted = [...closed].sort((a, b) => ringArea(b) - ringArea(a))
  const groups = []
  for (const ring of sorted) {
    const box = ringBBox(ring)
    const parent = groups.find((group) => bboxContains(group.box, box))
    if (parent) parent.holes.push(ring)
    else groups.push({ box, outer: ring, holes: [] })
  }
  const polygons = groups.map((group) => [group.outer, ...group.holes])
  return polygons.length === 1
    ? { type: 'Polygon', coordinates: polygons[0] }
    : { type: 'MultiPolygon', coordinates: polygons }
}

export function getGeoJsonBounds(geojson) {
  let minLon = Infinity
  let minLat = Infinity
  let maxLon = -Infinity
  let maxLat = -Infinity

  function walk(value) {
    if (!Array.isArray(value)) return
    if (typeof value[0] === 'number' && typeof value[1] === 'number') {
      const [x, y] = value
      minLon = Math.min(minLon, x)
      maxLon = Math.max(maxLon, x)
      minLat = Math.min(minLat, y)
      maxLat = Math.max(maxLat, y)
      return
    }
    for (const item of value) walk(item)
  }

  const geometries =
    geojson?.type === 'FeatureCollection'
      ? (geojson.features ?? []).map((feature) => feature.geometry)
      : geojson?.type === 'Feature'
        ? [geojson.geometry]
        : [geojson]
  for (const geometry of geometries) {
    if (geometry?.coordinates) walk(geometry.coordinates)
  }

  if (!Number.isFinite(minLon)) return null
  return { minLon, minLat, maxLon, maxLat }
}

export function centerOfBounds(bounds) {
  return {
    longitude: (bounds.minLon + bounds.maxLon) / 2,
    latitude: (bounds.minLat + bounds.maxLat) / 2,
  }
}

export function estimateFocusDistance(bounds) {
  if (!bounds) return 50_000
  const span = Math.max(bounds.maxLon - bounds.minLon, bounds.maxLat - bounds.minLat)
  const distance = span * 111_320 * 2.5
  return Math.min(cameraFocusRange.max, Math.max(cameraFocusRange.min, distance || 50_000))
}

// 批量解析上传文件，返回每项 { id, status, data?, message }
export async function parseBoundaryFiles(assets) {
  const results = []
  const prjByName = new Map()
  for (const asset of assets) {
    if (asset.format === 'prj') prjByName.set(baseName(asset.name), asset)
  }

  for (const asset of assets) {
    const format = asset.format
    try {
      if (COMPANION_FORMATS.has(format)) {
        results.push({ id: asset.id, status: 'companion', message: 'shp 配套文件' })
        continue
      }

      if (format === 'geojson' || format === 'json') {
        const data = normalizeGeoJson(JSON.parse(await asset.file.text()))
        results.push({
          id: asset.id,
          status: 'ready',
          data,
          message: `已解析 ${data.features.length} 个要素`,
        })
      } else if (format === 'shp') {
        const prjAsset = prjByName.get(baseName(asset.name))
        const prjText = prjAsset ? await prjAsset.file.text() : ''
        const data = parseShapefile(await asset.file.arrayBuffer())
        const projected = /PROJCS/i.test(prjText)
        results.push({
          id: asset.id,
          status: 'ready',
          data,
          message: projected
            ? `已解析 ${data.features.length} 个要素（prj 为投影坐标，位置可能偏移）`
            : `已解析 ${data.features.length} 个要素`,
        })
      } else {
        results.push({
          id: asset.id,
          status: 'unsupported',
          message: '暂不支持该格式，当前支持 .shp / .geojson / .json',
        })
      }
    } catch (e) {
      results.push({
        id: asset.id,
        status: 'error',
        message: e instanceof Error ? e.message : String(e),
      })
    }
  }

  return results
}
