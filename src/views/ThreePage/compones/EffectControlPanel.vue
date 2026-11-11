<script setup>
defineProps({
  config: { type: Object, required: true },
})

const emit = defineEmits(['update', 'reset'])

function update(key, value) {
  emit('update', { key, value })
}
</script>

<template>
  <section class="effect-control">
    <h2 class="effect-control__title">特效与交互控制</h2>
    <p class="effect-control__hint">
      边线流动光线与底部光环由同一组着色器驱动；关闭交互后仍可保持自动旋转。
    </p>

    <div class="effect-control__switches">
      <label class="effect-control__switch">
        <span>自动旋转</span>
        <input
          type="checkbox"
          :checked="config.autoRotate"
          @change="update('autoRotate', $event.target.checked)"
        />
        <i aria-hidden="true"></i>
      </label>
      <label class="effect-control__switch">
        <span>光效开关</span>
        <input
          type="checkbox"
          :checked="config.effects"
          @change="update('effects', $event.target.checked)"
        />
        <i aria-hidden="true"></i>
      </label>
      <label class="effect-control__switch">
        <span>交互开关</span>
        <input
          type="checkbox"
          :checked="config.interaction"
          @change="update('interaction', $event.target.checked)"
        />
        <i aria-hidden="true"></i>
      </label>
    </div>

    <div class="effect-control__slider">
      <div class="effect-control__slider-head">
        <span>旋转速度</span>
        <strong>{{ Number(config.rotationSpeed).toFixed(1) }}×</strong>
      </div>
      <input
        type="range"
        min="0.1"
        max="5"
        step="0.1"
        :value="config.rotationSpeed"
        @input="update('rotationSpeed', Number($event.target.value))"
      />
      <div class="effect-control__range"><span>0.1×</span><span>5.0×</span></div>
    </div>

    <dl class="effect-control__summary">
      <div><dt>自动旋转</dt><dd>{{ config.autoRotate ? '开启' : '禁止' }}</dd></div>
      <div><dt>光效</dt><dd>{{ config.effects ? '开启' : '关闭' }}</dd></div>
      <div><dt>交互</dt><dd>{{ config.interaction ? '可操作' : '已锁定' }}</dd></div>
      <div><dt>速度</dt><dd>{{ Number(config.rotationSpeed).toFixed(1) }}×</dd></div>
    </dl>

    <button type="button" class="effect-control__reset" @click="$emit('reset')">
      重置配置
    </button>
  </section>
</template>

<style lang="scss" scoped>
@use '../../../styles/variables' as *;
@use '../../../styles/mixins' as *;

.effect-control {
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

  &__switches {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: 12px;
  }

  &__switch {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 9px 12px;
    border: 1px solid $color-border;
    border-radius: $radius-sm;
    background: $color-surface-alt;
    color: $color-text;
    font-size: 12px;
    cursor: pointer;

    input {
      position: absolute;
      opacity: 0;
      pointer-events: none;
    }

    i {
      position: relative;
      flex: 0 0 36px;
      height: 20px;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.14);
      transition: background 0.2s;

      &::after {
        content: '';
        position: absolute;
        top: 3px;
        left: 3px;
        width: 14px;
        height: 14px;
        border-radius: 50%;
        background: $color-text;
        transition: transform 0.2s;
      }
    }

    input:checked + i {
      background: rgba($color-primary, 0.65);

      &::after {
        transform: translateX(16px);
        background: #fff;
      }
    }

    input:focus-visible + i {
      outline: 2px solid $color-primary;
      outline-offset: 2px;
    }
  }

  &__slider {
    margin-top: 16px;

    input[type='range'] {
      width: 100%;
      margin: 4px 0;
      accent-color: $color-primary;
      cursor: pointer;
    }
  }

  &__slider-head,
  &__range {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  &__slider-head {
    font-size: 12px;

    strong {
      color: $color-primary;
      font-variant-numeric: tabular-nums;
    }
  }

  &__range {
    color: $color-muted;
    font-size: 10px;
  }

  &__summary {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px 10px;
    margin: 16px 0 0;

    div {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 6px;
      min-width: 0;
      padding-bottom: 4px;
      border-bottom: 1px solid rgba($color-border, 0.6);
    }

    dt {
      color: $color-muted;
      font-size: 11px;
      white-space: nowrap;
    }

    dd {
      margin: 0;
      color: $color-text;
      font-size: 11px;
      font-variant-numeric: tabular-nums;
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
