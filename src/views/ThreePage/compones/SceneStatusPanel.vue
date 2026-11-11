<script setup>
defineProps({
  ready: { type: Boolean, default: false },
  error: { type: String, default: '' },
  stats: {
    type: Object,
    default: () => ({ featureCount: 0, polygonCount: 0, pointCount: 0 }),
  },
})
</script>

<template>
  <div class="scene-status-panel">
    <h1 class="page-title">黄冈市边界板块</h1>
    <p class="page-desc">
      three.js 读取 statics/黄冈市.json，将各区县 MultiPolygon 挤出成立体板块并高亮描边。
      按住左键旋转、滚轮缩放、右键平移。
    </p>
    <div class="scene-status-panel__tags">
      <span class="tag" :class="ready ? 'tag--ok' : 'tag--warn'">
        场景：{{ ready ? '运行中' : '初始化中' }}
      </span>
      <span class="tag" :class="stats.featureCount ? 'tag--ok' : 'tag--warn'">
        边界数据：{{ stats.featureCount }} 个区县 / {{ stats.polygonCount }} 个面
      </span>
      <span class="tag">{{ stats.pointCount.toLocaleString() }} 个坐标点</span>
    </div>
    <p v-if="error" class="scene-status-panel__error">WebGL 初始化失败：{{ error }}</p>
  </div>
</template>

<style lang="scss" scoped>
@use '../../../styles/variables' as *;
@use '../../../styles/mixins' as *;

.scene-status-panel {
  @include panel;
  flex: 0 0 auto;
  width: 100%;
  padding: 16px 18px;
  pointer-events: auto;

  .page-title {
    font-size: 18px;
  }

  .page-desc {
    font-size: 13px;
  }

  &__tags {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 12px;
  }

  &__error {
    margin: 12px 0 0;
    color: $color-warn;
    font-size: 13px;
  }
}
</style>
