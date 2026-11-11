import * as Cesium from 'cesium'
import { isRef, onBeforeUnmount, watch } from 'vue'

/**
 * Cesium 资源生命周期管理器
 * 统一管理 Entity / Primitive / DataSource / Event / 方法与清理函数。
 * 资源按组注册，可切换（显示或启用）、单个销毁、按组销毁、全部销毁，并可重新绑定 Viewer。
 */

export const RESOURCE_KIND = Object.freeze({
  ENTITY: 'entity',
  PRIMITIVE: 'primitive',
  DATA_SOURCE: 'dataSource',
  EVENT: 'event',
  METHOD: 'method',
  TASK: 'task',
})

const DEFAULT_GROUP = 'default'
let sequence = 0

function nextId(kind) {
  sequence += 1
  return `${kind}-${sequence}`
}

function runSafely(label, fn) {
  try {
    return fn()
  } catch (error) {
    console.warn(`[CesiumResourceManager] ${label}失败`, error)
    return undefined
  }
}

function isDestroyed(target) {
  return Boolean(target && typeof target.isDestroyed === 'function' && target.isDestroyed())
}

function isViewerAlive(viewer) {
  if (!viewer) return false
  return typeof viewer.isDestroyed === 'function' ? !viewer.isDestroyed() : true
}

export class CesiumResourceManager {
  constructor(viewer = null, options = {}) {
    this.viewer = viewer
    this.exclusive = options.exclusive ?? false // true 时 switchTo 只保留一个激活组
    this.onChange = options.onChange ?? null
    this.resources = new Map() // id -> record
    this.groups = new Map() // group -> Set<id>
    this.methods = new Map() // name -> id
    this.activeGroups = new Set()
    this.disposed = false
    this.batching = false
  }

  get size() {
    return this.resources.size
  }

  get viewerBound() {
    return isViewerAlive(this.viewer)
  }

  // ---------------- 绑定 ----------------

  bindViewer(viewer, { reset = true } = {}) {
    if (this.disposed) return this
    if (reset && this.viewer && this.viewer !== viewer) this.destroyAll()
    this.viewer = viewer
    this.emit('bind')
    return this
  }

  ensureViewer() {
    if (this.disposed) throw new Error('CesiumResourceManager 已销毁，请重新创建实例')
    if (!isViewerAlive(this.viewer)) {
      throw new Error('CesiumResourceManager 尚未绑定可用的 Cesium Viewer')
    }
    return this.viewer
  }

  /** 通用绑定：按类型分发到 entity / primitive / dataSource */
  bind(kind, resource, options = {}) {
    if (kind === RESOURCE_KIND.ENTITY) return this.entity(resource, options)
    if (kind === RESOURCE_KIND.PRIMITIVE) return this.primitive(resource, options)
    if (kind === RESOURCE_KIND.DATA_SOURCE) return this.dataSource(resource, options)
    throw new Error(`不支持的资源类型：${kind}`)
  }

  // ---------------- 资源注册 ----------------

  register(kind, target, options = {}) {
    if (this.disposed) throw new Error('CesiumResourceManager 已销毁，请重新创建实例')
    const id = options.id ?? nextId(kind)
    if (this.resources.has(id)) this.destroy(id)
    const group = options.group ?? DEFAULT_GROUP
    const record = {
      id,
      kind,
      group,
      target,
      enabled: options.enabled ?? true,
      meta: options.meta ?? {},
      dispose: options.dispose ?? (() => {}),
      setEnabled: options.setEnabled ?? (() => {}),
    }

    this.resources.set(id, record)
    if (!this.groups.has(group)) this.groups.set(group, new Set())
    this.groups.get(group).add(id)

    // 显式 enabled:false 或处于切换状态但不在激活组时，同步关闭实体显示 / 事件与方法状态
    const shouldEnable =
      record.enabled && (!this.activeGroups.size || this.activeGroups.has(group))
    if (!shouldEnable) this.applyEnabled(record, false)
    this.emit('add')
    return record
  }

  entity(input, options = {}) {
    const viewer = this.ensureViewer()
    const entity = viewer.entities.add(input)
    return this.register(RESOURCE_KIND.ENTITY, entity, {
      ...options,
      dispose: () => {
        if (isViewerAlive(this.viewer)) this.viewer.entities.remove(entity)
      },
      setEnabled: (on) => {
        entity.show = on
      },
    })
  }

  primitive(input, options = {}) {
    const viewer = this.ensureViewer()
    const primitive = viewer.scene.primitives.add(input)
    return this.register(RESOURCE_KIND.PRIMITIVE, primitive, {
      ...options,
      dispose: () => {
        if (isViewerAlive(this.viewer)) {
          const removed = this.viewer.scene.primitives.remove(primitive)
          if (!removed && !isDestroyed(primitive)) primitive.destroy?.()
        } else if (!isDestroyed(primitive)) {
          primitive.destroy?.()
        }
      },
      setEnabled: (on) => {
        primitive.show = on
      },
    })
  }

  dataSource(source, options = {}) {
    const viewer = this.ensureViewer()
    viewer.dataSources.add(source)
    return this.register(RESOURCE_KIND.DATA_SOURCE, source, {
      ...options,
      dispose: () => {
        if (isViewerAlive(this.viewer)) this.viewer.dataSources.remove(source, true)
        else if (!isDestroyed(source)) source.destroy?.()
      },
      setEnabled: (on) => {
        source.show = on
      },
    })
  }

  /** 便捷方法：加载 GeoJSON / URL 并作为 DataSource 托管 */
  async geoJson(data, options = {}) {
    this.ensureViewer()
    const { style, ...rest } = options
    const source = await Cesium.GeoJsonDataSource.load(data, style)
    return this.dataSource(source, rest)
  }

  /**
   * 通用事件绑定：支持 Cesium.Event / DOM 事件 / ScreenSpaceEventHandler / on-off 对象
   * 切换为关闭时保留监听，只是不执行回调；销毁时才真正移除。
   */
  event(target, type, callback, options = {}) {
    const state = { enabled: true }
    const context = options.context ?? null
    const wrapped = (...args) =>
      state.enabled ? callback.apply(context, args) : undefined
    let remove = () => {}

    if (typeof target?.setInputAction === 'function') {
      target.setInputAction(wrapped, type, options.modifiers)
      remove = () => {
        if (!isDestroyed(target)) target.removeInputAction(type, options.modifiers)
      }
    } else if (typeof target?.addEventListener === 'function') {
      const remover = target.addEventListener(wrapped, options.scope)
      remove =
        typeof remover === 'function'
          ? remover
          : () => target.removeEventListener?.(wrapped, options.scope)
    } else if (typeof target?.on === 'function') {
      target.on(type, wrapped)
      remove = () => target.off?.(type, wrapped)
    } else {
      throw new Error('不支持的事件目标')
    }

    return this.register(RESOURCE_KIND.EVENT, target, {
      ...options,
      dispose: () => {
        runSafely('移除事件监听', remove)
        if (typeof options.dispose === 'function') {
          runSafely('执行事件自定义清理', options.dispose)
        }
      },
      setEnabled: (on) => {
        state.enabled = on
      },
    })
  }

  /** 创建（或复用）ScreenSpaceEventHandler，自动托管其生命周期 */
  screenSpace(type, callback, options = {}) {
    const viewer = this.ensureViewer()
    const ownHandler = !options.handler
    const handler =
      options.handler ?? new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas)
    const customDispose = options.dispose
    return this.event(handler, type, callback, {
      ...options,
      dispose: ownHandler
        ? () => {
            handler.destroy()
            customDispose?.()
          }
        : customDispose,
    })
  }

  /** 注册具名方法：绑定 this、可被切换启用状态、可被 call 调用与移除 */
  method(name, fn, options = {}) {
    const state = { enabled: true }
    const context = options.context ?? this
    const bound = (...args) => (state.enabled ? fn.apply(context, args) : undefined)
    const record = this.register(RESOURCE_KIND.METHOD, bound, {
      ...options,
      dispose: () => {
        this.methods.delete(name)
        if (typeof options.dispose === 'function') {
          runSafely('执行方法自定义清理', options.dispose)
        }
      },
      setEnabled: (on) => {
        state.enabled = on
      },
    })
    this.methods.set(name, record.id)
    return bound
  }

  call(name, ...args) {
    const id = this.methods.get(name)
    return id ? this.resources.get(id)?.target(...args) : undefined
  }

  removeMethod(name) {
    const id = this.methods.get(name)
    return id ? this.destroy(id) : false
  }

  /** 注册任意清理函数，例如取消动画帧、清定时器、释放自建对象 */
  disposer(fn, options = {}) {
    return this.register(RESOURCE_KIND.TASK, fn, { ...options, dispose: fn })
  }

  // ---------------- 切换 ----------------

  applyEnabled(record, enabled) {
    record.enabled = enabled
    runSafely('切换资源状态', () => record.setEnabled(enabled))
  }

  setEnabled(target, enabled) {
    const record = this.resolve(target)
    if (!record) return false
    this.applyEnabled(record, enabled)
    this.emit('enable')
    return true
  }

  setGroupEnabled(group, enabled) {
    const records = this.groupMembers(group)
    records.forEach((record) => this.applyEnabled(record, enabled))
    if (this.activeGroups.size) {
      if (enabled) this.activeGroups.add(group)
      else this.activeGroups.delete(group)
    }
    this.emit('switch')
    return this
  }

  /** 切换到指定组：exclusive=true 时只保留第一个组；不传组名等于恢复全部 */
  switchTo(...names) {
    const list = names.flat(Infinity).filter(Boolean)
    this.activeGroups = new Set(this.exclusive ? list.slice(0, 1) : list)
    for (const record of this.resources.values()) {
      this.applyEnabled(
        record,
        this.activeGroups.size === 0 || this.activeGroups.has(record.group),
      )
    }
    this.emit('switch')
    return this
  }

  resetSwitch() {
    return this.switchTo()
  }

  // ---------------- 销毁 ----------------

  resolve(target) {
    const id = typeof target === 'string' ? target : target?.id
    return id ? (this.resources.get(id) ?? null) : null
  }

  get(target) {
    return this.resolve(target)
  }

  list(kind = null) {
    return [...this.resources.values()].filter((record) => !kind || record.kind === kind)
  }

  groupMembers(group) {
    return [...(this.groups.get(group) ?? [])]
      .map((id) => this.resources.get(id))
      .filter(Boolean)
  }

  destroy(target) {
    const record = this.resolve(target)
    if (!record) return false

    this.resources.delete(record.id)
    const ids = this.groups.get(record.group)
    if (ids) {
      ids.delete(record.id)
      if (!ids.size) this.groups.delete(record.group)
    }
    if (record.kind === RESOURCE_KIND.METHOD) {
      for (const [name, id] of this.methods) {
        if (id === record.id) this.methods.delete(name)
      }
    }
    runSafely(`销毁 ${record.kind}`, () => record.dispose())
    this.emit('destroy')
    return true
  }

  destroyGroup(group) {
    const ids = [...(this.groups.get(group) ?? [])]
    ids.forEach((id) => this.destroy(id))
    return ids.length
  }

  destroyAll() {
    const ids = [...this.resources.keys()]
    this.batching = true
    try {
      ids.forEach((id) => this.destroy(id))
    } finally {
      this.batching = false
    }
    this.resources.clear()
    this.groups.clear()
    this.methods.clear()
    this.activeGroups.clear()
    this.emit('destroyAll')
    return ids.length
  }

  /** 销毁全部资源并解绑 Viewer；幂等 */
  dispose() {
    if (this.disposed) return this
    this.destroyAll()
    this.viewer = null
    this.disposed = true
    this.emit('dispose')
    return this
  }

  // ---------------- 变更通知 ----------------

  emit(reason) {
    if (this.batching) return
    runSafely('通知变更', () =>
      this.onChange?.({
        reason,
        size: this.resources.size,
        groups: [...this.groups.keys()],
        activeGroups: [...this.activeGroups],
        viewerBound: this.viewerBound,
        disposed: this.disposed,
      }),
    )
  }
}

export function createCesiumResourceManager(viewer = null, options = {}) {
  return new CesiumResourceManager(viewer, options)
}

/** Vue 组合式封装：Viewer ref 变化时自动重绑，组件卸载时自动 dispose */
export function useCesiumResourceManager(viewerRef, options = {}) {
  const initialViewer = isRef(viewerRef) ? viewerRef.value : viewerRef
  const manager = createCesiumResourceManager(initialViewer, options)

  if (isRef(viewerRef)) {
    watch(viewerRef, (viewer) => manager.bindViewer(viewer), { flush: 'sync' })
  }
  onBeforeUnmount(() => manager.dispose())

  return manager
}

export default CesiumResourceManager
