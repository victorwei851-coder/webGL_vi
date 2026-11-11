<script setup>
import { weatherTypes } from '../weather'

const props = defineProps({
  config: { type: Object, required: true },
})

const emit = defineEmits(['update', 'reset'])

const groups = [
  {
    title: '晴天',
    type: 'clear',
    items: [{ key: 'sunBrightness', label: '光线亮度', min: 0.2, max: 3, step: 0.1, suffix: '×' }],
  },
  {
    title: '阴天',
    type: 'overcast',
    items: [{ key: 'overcastBrightness', label: '光线亮度', min: 0.2, max: 2, step: 0.1, suffix: '×' }],
  },
  {
    title: '雨天',
    type: 'rain',
    items: [{ key: 'rainSpeed', label: '下雨速度', min: 0.2, max: 3, step: 0.1, suffix: '×' }],
  },
  {
    title: '雪天',
    type: 'snow',
    items: [
      { key: 'snowSize', label: '雪花大小', min: 0.05, max: 0.8, step: 0.05, suffix: '' },
      { key: 'snowSpeed', label: '下落速度', min: 0.1, max: 2, step: 0.1, suffix: '×' },
    ],
  },
  {
    title: '雾天',
    type: 'fog',
    items: [{ key: 'fogDensity', label: '雾浓度', min: 0.005, max: 0.12, step: 0.005, suffix: '' }],
  },
  {
    title: '风',
    type: '*',
    items: [
      { key: 'windStrength', label: '风力大小', min: 0, max: 3, step: 0.1, suffix: '×' },
      { key: 'windDirection', label: '风向', min: 0, max: 360, step: 15, suffix: '°' },
    ],
  },
]

const DIRECTION_LABELS = ['东', '东南', '南', '西南', '西', '西北', '北', '东北']

function directionLabel(degrees) {
  return DIRECTION_LABELS[Math.round(degrees / 45) % 8]
}

function display(item, value) {
  const number = Number(value) || 0
  if (item.key === 'windDirection') return `${Math.round(number)}° · ${directionLabel(number)}`
  const digits = item.step < 0.05 ? 3 : item.step < 1 ? 2 : 1
  return `${number.toFixed(digits)}${item.suffix}`
}

function isActive(group) {
  return group.type === '*' || group.type === props.config.type
}

function update(key, value) {
  emit('update', { key, value })
}
</script>

<template>
  <section class="weather-panel">
    <h2 class="weather-panel__title">天气特效控制</h2>
    <p class="weather-panel__hint">
      选择天气后调节对应参数；风力与风向会影响雨雪粒子的漂移方向。
    </p>

    <div class="weather-panel__types">
      <button
        v-for="item in weatherTypes"
        :key="item.id"
        type="button"
        :class="{ 'is-active': config.type === item.id }"
        @click="update('type', item.id)"
      >
        {{ item.label }}
      </button>
    </div>

    <div v-for="group in groups" :key="group.title" class="weather-panel__group">
      <h3>
        {{ group.title }}
        <em v-if="!isActive(group)">当前不生效</em>
      </h3>
      <div v-for="item in group.items" :key="item.key" class="weather-panel__row">
        <div class="weather-panel__row-head">
          <span>{{ item.label }}</span>
          <strong>{{ display(item, config[item.key]) }}</strong>
        </div>
        <input
          type="range"
          :min="item.min"
          :max="item.max"
          :step="item.step"
          :value="config[item.key]"
          @input="update(item.key, Number($event.target.value))"
        />
      </div>
    </div>

    <button type="button" class="weather-panel__reset" @click="$emit('reset')">
      重置配置
    </button>
  </section>
</template>

<style lang="scss" scoped>
@use '../../../styles/variables' as *;
@use '../../../styles/mixins' as *;

.weather-panel {
  @include panel;
  flex: 0 0 auto;
  width: 100%;
  padding: 16px;
  pointer-events: auto;

  &__title {
    margin: 0 0 8px;
    font-size: 15px;
  }

  &__hint {
    margin: 0;
    color: $color-muted;
    font-size: 11px;
    line-height: 1.6;
  }

  &__types {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 6px;
    margin-top: 12px;

    button {
      padding: 7px 2px;
      border: 1px solid $color-border;
      border-radius: $radius-sm;
      background: $color-surface-alt;
      color: $color-text;
      font-size: 11px;

      &:hover {
        border-color: rgba($color-primary, 0.6);
      }

      &.is-active {
        border-color: $color-primary;
        background: rgba($color-primary, 0.18);
        color: $color-primary;
      }
    }
  }

  &__group {
    margin-top: 14px;
    padding-top: 12px;
    border-top: 1px solid rgba($color-border, 0.7);

    h3 {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      margin: 0 0 8px;
      color: $color-primary;
      font-size: 12px;

      em {
        color: $color-muted;
        font-size: 10px;
        font-style: normal;
        font-weight: 400;
      }
    }
  }

  &__row {
    margin-bottom: 10px;

    &:last-child {
      margin-bottom: 0;
    }

    input[type='range'] {
      width: 100%;
      margin: 4px 0 0;
      accent-color: $color-primary;
      cursor: pointer;
    }
  }

  &__row-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    color: $color-muted;
    font-size: 11px;

    strong {
      color: $color-text;
      font-size: 11px;
      font-variant-numeric: tabular-nums;
      font-weight: 500;
    }
  }

  &__reset {
    width: 100%;
    margin-top: 16px;
    padding: 9px 12px;
    border: 1px solid $color-primary;
    border-radius: $radius-sm;
    background: rgba($color-primary, 0.18);
    color: $color-primary;
    font-size: 12px;

    &:hover {
      background: rgba($color-primary, 0.28);
    }
  }
}
</style>
