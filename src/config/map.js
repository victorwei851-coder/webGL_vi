// 地图配置的唯一入口：key 只从本地文件读取，不写死在本文件（本文件会被提交）
// 优先级：.env.local 的 VITE_TIANDITU_KEY > src/config/map.local.js 的 TIANDITU_KEY
// map.local.js 已被 .gitignore 忽略，不会上传到远程仓库
const localKeyModules = import.meta.glob('./map.local.js', { eager: true })
const envKey = (import.meta.env.VITE_TIANDITU_KEY ?? '').trim()
const localKey = String(localKeyModules['./map.local.js']?.TIANDITU_KEY ?? '').trim()
const key = envKey || localKey
const host = (import.meta.env.VITE_TIANDITU_HOST ?? 'https://t{s}.tianditu.gov.cn').trim()

// 天地图 WMTS 地址模板。{s}/{x}/{y}/{z} 由 Cesium 的 UrlTemplateImageryProvider 替换
function tileUrl(layer, matrixSet = 'w') {
  return `${host}/${layer}_${matrixSet}/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=${layer}&STYLE=default&TILEMATRIXSET=${matrixSet}&FORMAT=tiles&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&tk=${key}`
}

export const tianditu = {
  key,
  ready: Boolean(key),
  host,
  subdomains: ['0', '1', '2', '3', '4', '5', '6', '7'],
  layers: {
    vec: tileUrl('vec'), // 矢量底图
    cva: tileUrl('cva'), // 矢量注记
    img: tileUrl('img'), // 影像底图（卫星/航空影像）
    cia: tileUrl('cia'), // 影像注记
  },
}

// 可切换的底图组合：base 为底图图层，label 为对应注记图层
// 第一项为默认底图：天地图卫星影像 img + 影像注记 cia
export const tiandituBaseLayers = [
  { id: 'img', name: '卫星影像', base: 'img', label: 'cia' },
  { id: 'vec', name: '矢量', base: 'vec', label: 'cva' },
]

export const defaultBaseLayer = tiandituBaseLayers[0].id

// 未加载边界数据时的默认视角（中国区域）
export const defaultView = {
  longitude: 104.5,
  latitude: 35.5,
  height: 9_000_000,
}

// 相机焦距（相机到中心点的距离，单位米）：滑块与轴按对数刻度映射到 steps
export const cameraFocusRange = {
  min: 100,
  max: 20_000_000,
  steps: 1000,
}

// 边界渲染样式：线不透明且更粗，填充实一点，便于在卫星影像上看清边界
export const boundaryStyle = {
  color: '#4cc9f0',
  strokeWidth: 4,
  strokeAlpha: 1,
  fillAlpha: 0.3,
}
