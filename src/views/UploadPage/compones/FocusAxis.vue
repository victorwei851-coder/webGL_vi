<script setup>
import { computed, ref, watch } from 'vue'
import { cameraFocusRange } from '@/config/map'
import { focusDistanceToValue, valueToFocusDistance } from '../utils'

const props = defineProps({
  modelValue: { type: Number, default: 0 },
})

const emit = defineEmits(['update:modelValue'])
const track = ref(null)
const dragging = ref(false)

const percent = computed(() => (props.modelValue / cameraFocusRange.steps) * 100)

function updateFromPointer(event) {
  const element = track.value
  if (!element) return
  const rect = element.getBoundingClientRect()
  const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width))
  emit('update:modelValue', Math.round(ratio * cameraFocusRange.steps))
}

function onPointerDown(event) {
  dragging.value = true
  track.value?.setPointerCapture?.(event.pointerId)
  updateFromPointer(event)
}

function onPointerMove(event) {
  if (dragging.value) updateFromPointer(event)
}

function onPointerUp(event) {
  dragging.value = false
  track.value?.releasePointerCapture?.(event.pointerId)
}

// 手动输入：km / m 两种单位，统一换算成米再映射回滑块与轴的 0~steps 数值
const unit = ref('km')
const factor = computed(() => (unit.value === 'km' ? 1000 : 1))
const displayValue = computed(() => valueToFocusDistance(props.modelValue) / factor.value)
const rangeHint = computed(() =>
  unit.value === 'km'
    ? `${(cameraFocusRange.min / 1000).toFixed(1)} ~ ${(cameraFocusRange.max / 1000).toFixed(0)} km`
    : `${cameraFocusRange.min} ~ ${cameraFocusRange.max} m`,
)

function formatValue(value) {
  if (value >= 1000) return value.toFixed(0)
  if (value >= 10) return value.toFixed(1)
  return value.toFixed(2)
}

const inputValue = ref(formatValue(displayValue.value))
const editing = ref(false)

watch([displayValue, unit], () => {
  if (!editing.value) inputValue.value = formatValue(displayValue.value)
})

function onInput(event) {
  const raw = event.target.value
  inputValue.value = raw
  if (raw === '' || raw === '-') return
  const number = Number(raw)
  if (!Number.isFinite(number)) return
  emit('update:modelValue', Math.round(focusDistanceToValue(number * factor.value)))
}

function onFocus() {
  editing.value = true
}

function onBlur() {
  editing.value = false
  inputValue.value = formatValue(displayValue.value)
}
</script>

<template>
  <div class="focus-axis">
    <div class="focus-axis__input">
      <label for="focus-distance-input">手动输入焦距</label>
      <div class="focus-axis__input-row">
        <input
          id="focus-distance-input"
          :value="inputValue"
          type="number"
          step="any"
          min="0"
          @focus="onFocus"
          @input="onInput"
          @blur="onBlur"
        />
        <select v-model="unit" aria-label="焦距单位">
          <option value="km">km</option>
          <option value="m">m</option>
        </select>
      </div>
      <p class="focus-axis__hint">范围 {{ rangeHint }}；输入后滑块、轴与相机同步</p>
    </div>

    <!-- <div
      ref="track"
      class="focus-axis__track"
      :class="{ 'focus-axis__track--dragging': dragging }"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
    >
      <div class="focus-axis__fill" :style="{ width: `${percent}%` }"></div>
      <div class="focus-axis__handle" :style="{ left: `${percent}%` }"></div>
    </div> -->
    <div class="focus-axis__labels">
      <span>近</span>
      <span>按住轴拖动</span>
      <span>远</span>
    </div>
  </div>
</template>

<style lang="scss" scoped>
@use '../../../styles/variables' as *;

.focus-axis {
  margin-top: 12px;

  &__input {
    margin-bottom: 12px;

    label {
      display: block;
      margin-bottom: 6px;
      color: $color-muted;
      font-size: 12px;
    }
  }

  &__input-row {
    display: flex;
    gap: 8px;

    input,
    select {
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

    input {
      flex: 1;
      min-width: 0;
    }

    select {
      flex: 0 0 68px;
    }
  }

  &__hint {
    margin: 6px 0 0;
    color: $color-muted;
    font-size: 11px;
    line-height: 1.5;
  }

  &__track {
    position: relative;
    height: 22px;
    border: 1px solid $color-border;
    border-radius: 999px;
    background: $color-surface-alt;
    cursor: ew-resize;
    touch-action: none;

    &--dragging .focus-axis__handle {
      box-shadow: 0 0 12px $color-primary;
    }
  }

  &__fill {
    position: absolute;
    top: 0;
    bottom: 0;
    left: 0;
    border-radius: 999px;
    background: rgba($color-primary, 0.25);
    pointer-events: none;
  }

  &__handle {
    position: absolute;
    top: 50%;
    width: 16px;
    height: 16px;
    margin-left: -8px;
    transform: translateY(-50%);
    border: 2px solid #fff;
    border-radius: 50%;
    background: $color-primary;
    box-shadow: 0 0 8px rgba($color-primary, 0.6);
    pointer-events: none;
  }

  &__labels {
    display: flex;
    justify-content: space-between;
    margin-top: 6px;
    color: $color-muted;
    font-size: 11px;
  }
}
</style>
