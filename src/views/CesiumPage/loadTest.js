import * as Cesium from 'cesium'
import { devices } from './deviceIcons'

export const MAX_DEVICES = 1_000_000

export const DEFAULT_LOAD_TEST_PARAMS = {
  total: 10_000,
  batchSize: 2_000, // 每帧加载上限
  initialBatch: 200, // 起始每帧加载量，之后逐级递增
  minBatch: 50,
  frameBudgetMs: 8, // 每帧工作耗时预算
  pixelSize: 4,
}

const DEVICE_COLORS = [
  Cesium.Color.fromCssColorString('#4cc9f0').withAlpha(0.85),
  Cesium.Color.fromCssColorString('#7cf0c4').withAlpha(0.85),
  Cesium.Color.fromCssColorString('#f5b971').withAlpha(0.85),
  Cesium.Color.fromCssColorString('#f47ac0').withAlpha(0.85),
]

const longitudes = devices.map((device) => device.longitude)
const latitudes = devices.map((device) => device.latitude)
const BOUNDS = {
  minLon: Math.min(...longitudes) - 0.25,
  maxLon: Math.max(...longitudes) + 0.25,
  minLat: Math.min(...latitudes) - 0.25,
  maxLat: Math.max(...latitudes) + 0.25,
}

function clamp(value, min, max) {
  const number = Number(value)
  if (!Number.isFinite(number)) return min
  return Math.min(max, Math.max(min, Math.round(number)))
}

export function normalizeParams(input = {}) {
  const defaults = DEFAULT_LOAD_TEST_PARAMS
  return {
    total: clamp(input.total ?? defaults.total, 1, MAX_DEVICES),
    batchSize: clamp(input.batchSize ?? defaults.batchSize, 100, 20_000),
    initialBatch: clamp(input.initialBatch ?? defaults.initialBatch, 10, 20_000),
    minBatch: clamp(input.minBatch ?? defaults.minBatch, 10, 20_000),
    frameBudgetMs: clamp(input.frameBudgetMs ?? defaults.frameBudgetMs, 2, 30),
    pixelSize: clamp(input.pixelSize ?? defaults.pixelSize, 2, 12),
  }
}

/**
 * 分帧逐级加载：requestAnimationFrame 每帧只添加一批点，
 * 按上一帧耗时在 [minBatch, batchSize] 之间逐级递增或回退，并受每帧时间预算约束。
 */
export function createProgressiveLoader({ viewer, manager, params, onProgress }) {
  const options = normalizeParams(params)
  const collection = new Cesium.PointPrimitiveCollection()
  const record = manager.primitive(collection, {
    id: 'load-test-points',
    group: 'loadTest',
    meta: { method: 'pointPrimitive', ...options },
  })
  manager.setEnabled(record, true)

  let loaded = 0
  let frames = 0
  let frameId = null
  let running = true
  let destroyed = false
  let currentBatch = Math.min(options.initialBatch, options.batchSize)
  let totalWorkMs = 0
  let lastFrameMs = 0
  let lastEmitAt = 0
  const startedAt = performance.now()

  function snapshot(status, now) {
    const elapsedMs = now - startedAt
    return {
      status,
      loaded,
      total: options.total,
      frames,
      currentBatch,
      batchSize: options.batchSize,
      initialBatch: options.initialBatch,
      frameBudgetMs: options.frameBudgetMs,
      pixelSize: options.pixelSize,
      elapsedMs,
      lastFrameMs,
      avgFrameMs: frames ? totalWorkMs / frames : 0,
      fps: elapsedMs > 0 ? Math.round((frames / elapsedMs) * 1000) : 0,
      progress: options.total ? loaded / options.total : 0,
    }
  }

  function emit(status, force = false) {
    const now = performance.now()
    if (!force && now - lastEmitAt < 100) return
    lastEmitAt = now
    onProgress?.(snapshot(status, now))
  }

  function step() {
    if (!running || destroyed) return
    const frameStart = performance.now()
    let added = 0

    while (
      added < currentBatch &&
      loaded < options.total &&
      performance.now() - frameStart < options.frameBudgetMs
    ) {
      const longitude = BOUNDS.minLon + Math.random() * (BOUNDS.maxLon - BOUNDS.minLon)
      const latitude = BOUNDS.minLat + Math.random() * (BOUNDS.maxLat - BOUNDS.minLat)
      collection.add({
        position: Cesium.Cartesian3.fromDegrees(longitude, latitude),
        color: DEVICE_COLORS[loaded % DEVICE_COLORS.length],
        pixelSize: options.pixelSize,
      })
      loaded += 1
      added += 1
    }

    const cost = performance.now() - frameStart
    frames += 1
    totalWorkMs += cost
    lastFrameMs = cost

    // 逐级调整：耗时富余则提升每帧加载量，超出预算则回退
    if (cost > options.frameBudgetMs * 1.1) {
      currentBatch = Math.max(options.minBatch, Math.floor(currentBatch * 0.7))
    } else if (cost < options.frameBudgetMs * 0.6) {
      currentBatch = Math.min(options.batchSize, Math.ceil(currentBatch * 1.25))
    }

    if (loaded >= options.total) {
      running = false
      emit('done', true)
      return
    }
    emit('loading')
    frameId = requestAnimationFrame(step)
  }

  function cancel(notify = true) {
    if (destroyed) return
    if (!running) {
      if (notify) emit('stopped', true)
      return
    }
    running = false
    if (frameId !== null) cancelAnimationFrame(frameId)
    frameId = null
    if (notify) emit('stopped', true)
  }

  function destroy() {
    if (destroyed) return
    cancel(false)
    destroyed = true
    manager.destroy(record)
  }

  emit('loading', true)
  frameId = requestAnimationFrame(step)

  return {
    cancel,
    destroy,
    get running() {
      return running && !destroyed
    },
  }
}
