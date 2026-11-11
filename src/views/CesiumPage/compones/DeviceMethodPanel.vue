<script setup>
defineProps({
  methods: { type: Array, default: () => [] },
  active: { type: String, default: '' },
  count: { type: Number, default: 0 },
})

defineEmits(['change'])
</script>

<template>
  <aside class="device-methods">
    <h2 class="device-methods__title">设备图标渲染方式</h2>
    <div class="device-methods__list">
      <button
        v-for="method in methods"
        :key="method.id"
        type="button"
        class="device-methods__button"
        :class="{ 'is-active': active === method.id }"
        @click="$emit('change', method.id)"
      >
        <strong>{{ method.label }}</strong>
        <span>{{ method.desc }}</span>
      </button>
    </div>
    <p class="device-methods__hint">
      {{ count }} 个设备点位，图标取自 statics/icon（4 种按类型循环使用）。
    </p>
  </aside>
</template>

<style lang="scss" scoped>
@use '../../../styles/variables' as *;
@use '../../../styles/mixins' as *;

.device-methods {
  @include panel;
  flex: 0 0 auto;
  width: 100%;
  padding: 16px;
  pointer-events: auto;

  &__title {
    margin: 0 0 12px;
    font-size: 15px;
  }

  &__list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  &__button {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 9px 12px;
    border: 1px solid $color-border;
    border-radius: $radius-sm;
    background: $color-surface-alt;
    color: $color-text;
    text-align: left;

    strong {
      font-size: 13px;
      font-weight: 600;
    }

    span {
      color: $color-muted;
      font-size: 11px;
      line-height: 1.5;
    }

    &:hover {
      border-color: rgba($color-primary, 0.6);
    }

    &.is-active {
      border-color: $color-primary;
      background: rgba($color-primary, 0.14);

      strong {
        color: $color-primary;
      }
    }
  }

  &__hint {
    margin: 12px 0 0;
    color: $color-muted;
    font-size: 11px;
    line-height: 1.6;
  }
}

@media (max-width: 900px) {
  .device-methods__list {
    flex-direction: row;
    flex-wrap: wrap;
  }

  .device-methods__button {
    flex: 1 1 130px;
  }
}
</style>
