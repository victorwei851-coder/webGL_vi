import { cameraFocusRange } from '@/config/map'

export function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

// 滑块 / 轴的 0~steps 数值 <-> 相机距离（米）按对数映射，近处更精细
export function valueToFocusDistance(value) {
  const ratio = Math.min(1, Math.max(0, Number(value) / cameraFocusRange.steps || 0))
  return cameraFocusRange.min * (cameraFocusRange.max / cameraFocusRange.min) ** ratio
}

export function focusDistanceToValue(distance) {
  const clamped = Math.min(
    cameraFocusRange.max,
    Math.max(cameraFocusRange.min, Number(distance) || cameraFocusRange.min),
  )
  return (
    (cameraFocusRange.steps * Math.log(clamped / cameraFocusRange.min)) /
    Math.log(cameraFocusRange.max / cameraFocusRange.min)
  )
}

export function formatFocusDistance(distance) {
  return distance >= 1000 ? `${(distance / 1000).toFixed(1)} km` : `${Math.round(distance)} m`
}
