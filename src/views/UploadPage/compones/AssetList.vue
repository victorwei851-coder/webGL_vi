<script setup>
import { formatSize } from '../utils'

defineProps({
  assets: { type: Array, default: () => [] },
  activeId: { type: String, default: null },
})

defineEmits(['show', 'remove', 'clear'])

const statusText = {
  pending: '待解析',
  ready: '已解析',
  error: '解析失败',
  unsupported: '暂不支持',
  companion: '配套文件',
}

function statusClass(status) {
  if (status === 'ready') return 'tag--ok'
  if (status === 'error' || status === 'unsupported') return 'tag--warn'
  return ''
}
</script>

<template>
  <div class="asset-list">
    <div class="asset-list__header">
      <h2>已登记文件（{{ assets.length }}）</h2>
      <button
        type="button"
        class="asset-list__link"
        :disabled="!assets.length"
        @click="$emit('clear')"
      >
        清空
      </button>
    </div>

    <ul v-if="assets.length" class="asset-list__items">
      <li
        v-for="asset in assets"
        :key="asset.id"
        class="asset-list__item"
        :class="{ 'is-active': activeId === asset.id }"
      >
        <div class="asset-list__item-main">
          <span class="asset-list__format">{{ asset.format }}</span>
          <div class="asset-list__info">
            <span class="asset-list__name">{{ asset.name }}</span>
            <span class="asset-list__message">{{ asset.message }}</span>
          </div>
        </div>
        <div class="asset-list__item-meta">
          <span>{{ formatSize(asset.size) }}</span>
          <span class="tag" :class="statusClass(asset.status)">
            {{ statusText[asset.status] ?? asset.status }}
          </span>
          <button
            v-if="asset.status === 'ready'"
            type="button"
            class="asset-list__link"
            @click="$emit('show', asset.id)"
          >
            回显
          </button>
          <button type="button" class="asset-list__link" @click="$emit('remove', asset.id)">
            移除
          </button>
        </div>
      </li>
    </ul>
    <p v-else class="asset-list__empty">
      暂无文件。上传 .shp（可连同同名 .dbf / .shx / .prj）或 .geojson / .json 后自动回显边界。
    </p>
  </div>
</template>

<style lang="scss" scoped>
@use '../../../styles/variables' as *;
@use '../../../styles/mixins' as *;

.asset-list {
  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;

    h2 {
      font-size: 16px;
    }
  }

  &__link {
    padding: 4px 8px;
    border: 0;
    background: transparent;
    color: $color-primary;
    font-size: 13px;

    &:disabled {
      color: $color-muted;
      cursor: not-allowed;
    }
  }

  &__items {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin: 12px 0 0;
    padding: 0;
    list-style: none;
  }

  &__item {
    @include panel;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 12px 14px;

    &.is-active {
      border-color: rgba($color-primary, 0.6);
    }

    &-main,
    &-meta {
      display: flex;
      align-items: center;
      gap: 10px;
      min-width: 0;
    }

    &-meta {
      flex: 0 0 auto;
      color: $color-muted;
      font-size: 12px;
    }
  }

  &__info {
    display: flex;
    flex-direction: column;
    gap: 3px;
    min-width: 0;
  }

  &__format {
    flex: 0 0 auto;
    padding: 3px 8px;
    border-radius: $radius-sm;
    background: rgba($color-primary, 0.14);
    color: $color-primary;
    font-size: 12px;
    text-transform: uppercase;
  }

  &__name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 13px;
  }

  &__message {
    color: $color-muted;
    font-size: 11px;
  }

  &__empty {
    @include panel;
    padding: 24px;
    color: $color-muted;
    font-size: 13px;
    text-align: center;
  }
}

@media (max-width: 640px) {
  .asset-list__item {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
