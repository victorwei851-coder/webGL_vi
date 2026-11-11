<script setup>
import { computed } from 'vue'
import { cameraFocusRange } from '@/config/map'
import { useMapStore } from '@/stores/map'
import { focusDistanceToValue, formatFocusDistance, valueToFocusDistance } from '../utils'
import FocusAxis from './FocusAxis.vue'

defineProps({
  picking: { type: Boolean, default: false },
  error: { type: String, default: '' },
})

defineEmits(['pick', 'cancel-pick'])

const store = useMapStore()

function toCoordinate(value, type) {
  if (value === '' || value === null) return null
  const number = Number(value)
  return Number.isFinite(number) ? { ...store.centerPoint, [type]: number } : null
}

const longitude = computed({
  get: () => Number(store.centerPoint.longitude.toFixed(6)),
  set: (value) => {
    const point = toCoordinate(value, 'longitude')
    if (point) store.setCenterPoint(point)
  },
})

const latitude = computed({
  get: () => Number(store.centerPoint.latitude.toFixed(6)),
  set: (value) => {
    const point = toCoordinate(value, 'latitude')
    if (point) store.setCenterPoint(point)
  },
})

const focusValue = computed({
  get: () => Math.round(focusDistanceToValue(store.focusDistance)),
  set: (value) => store.setFocusDistance(valueToFocusDistance(value)),
})

const focusLabel = computed(() => formatFocusDistance(store.focusDistance))
</script>

<template>
  <section class="map-config">
    <h2 class="map-config__title">地图配置</h2>
    <p class="map-config__hint">底图为天地图卫星影像，key 与图层地址由 src/config/map.js 读取。</p>

    <div class="map-config__row">
      <label class="map-config__field">
        <span>中心点经度</span>
        <input v-model.number="longitude" type="number" step="0.000001" min="-180" max="180" />
      </label>
      <label class="map-config__field">
        <span>中心点纬度</span>
        <input v-model.number="latitude" type="number" step="0.000001" min="-90" max="90" />
      </label>
    </div>
    <p class="map-config__value">当前打点：{{ longitude.toFixed(6) }}°, {{ latitude.toFixed(6) }}°</p>

    <button
      type="button"
      class="map-config__pick"
      :class="{ 'is-active': picking }"
      @click="picking ? $emit('cancel-pick') : $emit('pick')"
    >
      {{ picking ? '取消配置（点击地图选择打点）' : '配置中心点' }}
    </button>
    <p class="map-config__hint">
      点击按钮后在地图上单击即可打点并回显经纬度；直接修改输入框也会反向移动打点。
    </p>

    <div class="map-config__focus">
      <div class="map-config__focus-head">
        <span>照相机焦距</span>
        <strong>{{ focusLabel }}</strong>
      </div>
      <input
        v-model.number="focusValue"
        class="map-config__slider"
        type="range"
        :min="0"
        :max="cameraFocusRange.steps"
        step="1"
      />
      <FocusAxis v-model="focusValue" />
      <p class="map-config__hint">滑块与轴共用同一数值，任一处拖动都会实时改变相机距离。</p>
    </div>

    <p v-if="error" class="map-config__error">{{ error }}</p>
  </section>
</template>

<style lang="scss" scoped>
@use '../../../styles/variables' as *;
@use '../../../styles/mixins' as *;

.map-config {
  @include panel;
  margin-top: 24px;
  padding: 18px;

  &__title {
    margin: 0 0 8px;
    font-size: 16px;
  }

  &__hint {
    margin: 8px 0 0;
    color: $color-muted;
    font-size: 12px;
    line-height: 1.6;
  }

  &__row {
    display: flex;
    gap: 10px;
    margin-top: 14px;
  }

  &__field {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 6px;
    min-width: 0;
    color: $color-muted;
    font-size: 12px;

    input {
      width: 100%;
      padding: 8px 10px;
      border: 1px solid $color-border;
      border-radius: $radius-sm;
      background: $color-surface-alt;
      color: $color-text;
      font-size: 13px;

      &:focus {
        outline: none;
        border-color: $color-primary;
      }
    }
  }

  &__value {
    margin: 10px 0 0;
    color: $color-accent;
    font-size: 12px;
    font-variant-numeric: tabular-nums;
  }

  &__pick {
    width: 100%;
    margin-top: 12px;
    padding: 9px 12px;
    border: 1px solid rgba($color-primary, 0.5);
    border-radius: $radius-sm;
    background: rgba($color-primary, 0.12);
    color: $color-primary;
    font-size: 13px;

    &.is-active {
      background: $color-primary;
      color: #06121c;
    }
  }

  &__focus {
    margin-top: 18px;
    padding-top: 14px;
    border-top: 1px solid $color-border;

    &-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 13px;

      strong {
        color: $color-primary;
        font-variant-numeric: tabular-nums;
      }
    }
  }

  &__slider {
    width: 100%;
    margin-top: 12px;
    accent-color: $color-primary;
  }

  &__error {
    margin: 12px 0 0;
    color: $color-warn;
    font-size: 12px;
  }
}
</style>
