<script setup>
defineProps({
  keyReady: { type: Boolean, default: false },
  boundaryReady: { type: Boolean, default: false },
  platesReady: { type: Boolean, default: false },
  assetCount: { type: Number, default: 0 },
})

// 设计说明：按「概述 — 模块与延伸思考 — 产品化设想」分段，内容可直接在此维护
const designDoc = {
  title: '设计说明',
  paragraphs: [
    '本项目提供三个可视化模块：模块一基于 Cesium 呈现地图边界与设备点位，模块二基于 three.js 构建地图板块模型，模块三基于 Cesium 完成底图配置与边界数据上传。',
    '模块一 · Cesium 地图可视化：以天地图影像为底图展示行政边界，提供设备图标的多种渲染方式与资源生命周期管理；内置首屏万级点位的分帧逐级加载测试工具，用于验证并缓解大数据量初始化时的卡顿。',
    '模块一延伸 · 渲染压力分担：首屏性能优化仍有不少值得探讨的细节。可借助第三方地图服务提供的瓦片或影像二次覆盖地图模型，把数据与内存压力转移到服务端，浏览器本地主要承担 GPU 与内存开销。',
    '模块一延伸 · 内存治理：频繁切换地图路由容易引发内存泄漏，且排查成本很高。可在项目初期规划前端底层架构，用 iframe 隔离数据或微前端部署来分散渲染压力；浏览器刷新属于冷启动，WebGL 渲染线程会重建，虽能回收泄漏内存，却会带来卡顿与缓存丢失；而路由跳转属于热更新，渲染线程不会重置，泄漏更容易累积。',
    '模块一延伸 · 资源生命周期：本项目通过封装 Cesium 资源生命周期管理器，统一托管实体、图元、事件与数据源的绑定和销毁，把泄漏控制在最小范围。由于 Cesium 是第三方库，部分泄漏难以完全避免；若投入充足，也可自研适配业务的 3D 库与工具组件，更彻底地解决这一问题。',
    '模块二 · three.js 板块模型：将 GeoJSON 边界挤出为立体板块，叠加边线流动光、底部光环与天气特效，并提供旋转、光效、交互及天气参数的实时控制。',
    '模块二延伸 · 轻量模型：three.js 可结合纹理贴图与粒子系统渲染模型，体量较小时能获得很好的交互效果。大型项目建议将复杂模型拆分后分别渲染展示，以保证交互流畅。',
    '模块二延伸 · 重型模型：若必须全量展示大型复杂模型，可考虑两类方案——服务端的「像素流送」，或浏览器本地的「WebAssembly + WebGPU」编译执行。像素流送是在高配机器上运行 UE（Unreal Engine）工程，由服务端完成渲染并把画面回传浏览器，交互亦可回传；其显示效果与交互响应都受 UE 服务端性能制约。',
    '模块三 · 上传与配置：以 Cesium 底图为基础配置中心点、相机焦距等属性，支持上传并回显 GeoJSON / Shapefile 边界；接入服务端后，可通过后端接口将录入数据持久化到数据库。',
    '产品化设想一 · 数据贯通：模块三录入的边界数据可在模块一、模块二直接展示。前提是统一坐标系——当前默认按 WGS84 经纬度处理，可增加坐标系参数字段加以区分，并保证录入数据与模块一使用的坐标系一致。',
    '产品化设想二 · 视图联动：模块一与模块二的地图数据可双向联动，例如在模块一点击某个板块下钻至模块二查看立体模型，也可从模块二跳转回模块一继续查看地图上下文；具体交互形式可依据产品需求由交互设计进一步定义。',
  ],
}
</script>

<template>
  <div class="status-grid">
    <div class="status-grid__item">
      <span>天地图 Key</span>
      <strong :class="keyReady ? 'is-ok' : 'is-warn'">
        {{ keyReady ? '已配置（本地配置文件）' : '未配置，请在 src/config/map.local.js 或 .env.local 填写 key' }}
      </strong>
    </div>
    <div class="status-grid__item">
      <span>边界数据</span>
      <strong>{{ boundaryReady ? '已加载' : `已登记 ${assetCount} 个文件，等待解析` }}</strong>
    </div>
    <div class="status-grid__item">
      <span>板块模型</span>
      <strong>{{ platesReady ? '已就绪' : '等待板块数据' }}</strong>
    </div>
    <section class="status-grid__doc">
      <h2 class="status-grid__doc-title">{{ designDoc.title }}</h2>
      <div class="status-grid__doc-body">
        <p v-for="(text, index) in designDoc.paragraphs" :key="index">{{ text }}</p>
      </div>
    </section>
  </div>
</template>

<style lang="scss" scoped>
@use '../../../styles/variables' as *;
@use '../../../styles/mixins' as *;

.status-grid {
  @include panel;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 20px;
  margin-top: 24px;
  padding: 20px 24px;

  &__item {
    display: flex;
    flex-direction: column;
    gap: 6px;
    font-size: 13px;

    span {
      color: $color-muted;
    }

    strong {
      font-weight: 500;
    }

    .is-ok {
      color: $color-accent;
    }

    .is-warn {
      color: $color-warn;
    }
  }

  &__doc {
    grid-column: 1 / -1;
    padding-top: 18px;
    border-top: 1px solid rgba($color-border, 0.8);

    &-title {
      margin: 0 0 10px;
      color: $color-primary;
      font-size: 15px;
    }

    &-body {
      color: $color-muted;
      font-size: 13px;
      line-height: 1.8;

      p {
        margin: 0 0 8px;

        &:last-child {
          margin-bottom: 0;
        }
      }
    }
  }
}
</style>
