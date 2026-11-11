<script setup>
import { RouterLink } from 'vue-router'

defineProps({
  feature: { type: Object, required: true },
})
</script>

<template>
  <RouterLink :to="feature.to" class="feature-card">
    <span class="feature-card__index">{{ feature.index }}</span>
    <h2 class="feature-card__title">{{ feature.title }}</h2>
    <p class="feature-card__desc">{{ feature.desc }}</p>
    <div class="feature-card__tags">
      <span v-for="tag in feature.tags" :key="tag">{{ tag }}</span>
    </div>
  </RouterLink>
</template>

<style lang="scss" scoped>
@use '../../../styles/variables' as *;
@use '../../../styles/mixins' as *;

.feature-card {
  @include panel;
  display: flex;
  flex-direction: column;
  padding: 22px;
  transition: transform 0.2s, border-color 0.2s;

  &:hover {
    transform: translateY(-3px);
    border-color: rgba($color-primary, 0.5);
  }

  &__index {
    color: $color-primary;
    font-size: 13px;
    letter-spacing: 2px;
  }

  &__title {
    margin: 14px 0 8px;
    font-size: 18px;
  }

  &__desc {
    flex: 1;
    margin: 0 0 18px;
    color: $color-muted;
    font-size: 14px;
    line-height: 1.7;
  }

  &__tags {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;

    span {
      padding: 3px 8px;
      border-radius: $radius-sm;
      background: $color-surface-alt;
      color: $color-muted;
      font-size: 12px;
    }
  }
}
</style>
