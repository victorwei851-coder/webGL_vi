import * as Cesium from 'cesium'
import huanggang from '../../../statics/黄冈市.json'
import icon1 from '../../../statics/icon/icon1.png'
import icon2 from '../../../statics/icon/icon2.png'
import icon3 from '../../../statics/icon/icon3.png'
import icon4 from '../../../statics/icon/icon4.png'

const DEVICE_ICONS = [icon1, icon2, icon3, icon4]
const DEVICE_TYPES = ['摄像头', '传感器', '基站', '网关']

// 四种渲染方式，对应 CesiumResourceManager 的四个资源组
export const deviceMethods = [
  { id: 'entity', label: 'Entity', desc: 'viewer.entities.add，每个设备一个 BillboardGraphics' },
  { id: 'primitive', label: 'Primitive', desc: 'BillboardCollection，一次批量提交图元' },
  { id: 'dataSource', label: 'DataSource', desc: 'CustomDataSource，整组显示 / 隐藏' },
  { id: 'dom', label: 'DOM 叠加', desc: 'postRender 投影 + HTML 图标' },
]

// 用黄冈市各区县中心作为示例设备点位，4 个图标按类型循环使用
export const devices = huanggang.features.map((feature, index) => {
  const point = feature.properties.centroid ?? feature.properties.center ?? [0, 0]
  return {
    id: String(feature.properties.adcode ?? index),
    name: feature.properties.name ?? `设备 ${index + 1}`,
    type: DEVICE_TYPES[index % DEVICE_TYPES.length],
    longitude: point[0],
    latitude: point[1],
    icon: DEVICE_ICONS[index % DEVICE_ICONS.length],
  }
})

function positionOf(device) {
  return Cesium.Cartesian3.fromDegrees(device.longitude, device.latitude)
}

function billboardOptions(device, size = 36) {
  return {
    image: device.icon,
    width: size,
    height: size,
    verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
    disableDepthTestDistance: Number.POSITIVE_INFINITY,
  }
}

// 方法一：Entity + BillboardGraphics
function renderEntityGroup(manager) {
  devices.forEach((device) => {
    manager.entity(
      {
        name: `${device.name} · ${device.type}`,
        position: positionOf(device),
        billboard: billboardOptions(device),
        label: {
          text: device.name,
          font: '12px sans-serif',
          fillColor: Cesium.Color.WHITE,
          showBackground: true,
          backgroundColor: Cesium.Color.fromCssColorString('#0b1020').withAlpha(0.75),
          pixelOffset: new Cesium.Cartesian2(0, -40),
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
      },
      { group: 'entity', meta: { deviceId: device.id, method: 'entity' } },
    )
  })
}

// 方法二：Primitive + BillboardCollection
function renderPrimitiveGroup(manager) {
  const collection = new Cesium.BillboardCollection()
  devices.forEach((device) => {
    collection.add({ position: positionOf(device), ...billboardOptions(device) })
  })
  manager.primitive(collection, { group: 'primitive', meta: { method: 'primitive' } })
}

// 方法三：DataSource + CustomDataSource
function renderDataSourceGroup(manager) {
  const source = new Cesium.CustomDataSource('device-icons')
  devices.forEach((device) => {
    source.entities.add({
      name: `${device.name} · ${device.type}`,
      position: positionOf(device),
      billboard: billboardOptions(device),
    })
  })
  manager.dataSource(source, { group: 'dataSource', meta: { method: 'dataSource' } })
}

// 方法四：DOM 叠加，用 postRender 事件把经纬度投影到屏幕坐标
function renderDomGroup(manager, viewer, containerEl) {
  const layer = document.createElement('div')
  Object.assign(layer.style, {
    position: 'absolute',
    inset: '0',
    overflow: 'hidden',
    pointerEvents: 'none',
    zIndex: '3',
  })

  const markers = devices.map((device) => {
    const marker = document.createElement('div')
    Object.assign(marker.style, {
      position: 'absolute',
      left: '0',
      top: '0',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '2px',
      transform: 'translate(-9999px, -9999px)',
      color: '#e8eefc',
      fontSize: '11px',
      textShadow: '0 1px 3px #000',
      whiteSpace: 'nowrap',
    })
    const image = document.createElement('img')
    image.src = device.icon
    image.alt = device.name
    Object.assign(image.style, { width: '32px', height: '32px' })
    const caption = document.createElement('span')
    caption.textContent = device.name
    marker.append(image, caption)
    layer.appendChild(marker)
    return { marker, position: positionOf(device) }
  })
  containerEl.appendChild(layer)

  const update = () => {
    markers.forEach(({ marker, position }) => {
      const screen = viewer.scene.cartesianToCanvasCoordinates(position)
      if (!screen) {
        marker.style.display = 'none'
        return
      }
      marker.style.display = 'flex'
      marker.style.transform = `translate(${screen.x}px, ${screen.y}px) translate(-50%, -100%)`
    })
  }
  update()

  manager.event(viewer.scene.postRender, 'postRender', update, {
    group: 'dom',
    meta: { method: 'dom' },
  })
  manager.disposer(() => layer.remove(), {
    group: 'dom',
    meta: { method: 'dom' },
    setEnabled: (on) => {
      layer.style.display = on ? '' : 'none'
    },
  })
}

export function renderDeviceIcons(manager, containerEl) {
  const viewer = manager.ensureViewer()
  renderEntityGroup(manager)
  renderPrimitiveGroup(manager)
  renderDataSourceGroup(manager)
  if (containerEl) renderDomGroup(manager, viewer, containerEl)
  return devices.length
}
