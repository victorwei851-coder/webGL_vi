<script setup>
import { computed, ref } from 'vue'
import { DEFAULT_LOAD_TEST_PARAMS, MAX_DEVICES } from '../loadTest'

const props = defineProps({
  stats: { type: Object, default: null },
})

defineEmits(['start', 'stop', 'clear'])

const form = ref({ ...DEFAULT_LOAD_TEST_PARAMS })
const status = computed(() => props.stats?.status ?? 'idle')
const running = computed(() => status.value === 'loading')
const progress = computed(() => Math.round((props.stats?.progress ?? 0) * 100))

const STATUS_TEXT = {
  idle: '待开始',
  loading: '加载中',
  done: '已完成',
  stopped: '已停止',
}
const statusText = computed(() => STATUS_TEXT[status.value] ?? status.value)

function formatMs(value) {
  const ms = Number(value) || 0
  return ms >= 1000 ? `${(ms / 1000).toFixed(2)} s` : `${Math.round(ms)} ms`
}
</script>

<template>
  <section class="load-test">
    <h2 class="load-test__title">分帧加载压力测试</h2>
    <p class="load-test__hint">
      首屏自动加载 1w 个点位；使用 PointPrimitiveCollection + requestAnimationFrame 逐帧追加。
    </p>

    <div class="load-test__form">
      <label>
        设备数量（1 - {{ MAX_DEVICES }} / 1-100w）
        <input v-model.number="form.total" type="number" :min="1" :max="MAX_DEVICES" step="1000" />
      </label>
      <label>
        每帧加载上限（个）
        <input v-model.number="form.batchSize" type="number" min="100" max="20000" step="100" />
      </label>
      <label>
        每帧时间预算（ms）
        <input v-model.number="form.frameBudgetMs" type="number" min="2" max="30" step="1" />
      </label>
      <label>
        点大小（px）
        <input v-model.number="form.pixelSize" type="number" min="2" max="12" step="1" />
      </label>
    </div>

    <div class="load-test__actions">
      <button type="button" class="is-primary" @click="$emit('start', { ...form })">
        {{ running ? '重新测试' : '开始测试' }}
      </button>
      <button type="button" :disabled="!running" @click="$emit('stop')">停止</button>
      <button type="button" @click="$emit('clear')">清空点位</button>
    </div>

    <h3 class="load-test__subtitle">关键参数</h3>
    <dl class="load-test__stats">
      <div><dt>目标设备数</dt><dd>{{ stats?.total ?? form.total }}</dd></div>
      <div><dt>每帧上限</dt><dd>{{ stats?.batchSize ?? form.batchSize }}</dd></div>
      <div><dt>起始每帧</dt><dd>{{ stats?.initialBatch ?? DEFAULT_LOAD_TEST_PARAMS.initialBatch }}</dd></div>
      <div><dt>当前每帧加载</dt><dd>{{ stats?.currentBatch ?? 0 }}</dd></div>
      <div><dt>每帧时间预算</dt><dd>{{ stats?.frameBudgetMs ?? form.frameBudgetMs }} ms</dd></div>
      <div><dt>已用帧数</dt><dd>{{ stats?.frames ?? 0 }}</dd></div>
      <div><dt>已加载</dt><dd>{{ stats?.loaded ?? 0 }}</dd></div>
      <div><dt>进度</dt><dd>{{ progress }}%</dd></div>
      <div><dt>累计耗时</dt><dd>{{ formatMs(stats?.elapsedMs) }}</dd></div>
      <div><dt>上一帧耗时</dt><dd>{{ (stats?.lastFrameMs ?? 0).toFixed(1) }} ms</dd></div>
      <div><dt>平均帧耗时</dt><dd>{{ (stats?.avgFrameMs ?? 0).toFixed(1) }} ms</dd></div>
      <div><dt>实际帧率</dt><dd>{{ stats?.fps ?? 0 }} fps</dd></div>
      <div><dt>状态</dt><dd>{{ statusText }}</dd></div>
    </dl>

    <div class="load-test__progress"><div :style="{ width: `${progress}%` }"></div></div>
    <p class="load-test__hint">
      每帧按时间预算自适应调整加载量（逐级递增 / 回退），不会一次性阻塞主线程。
      100w 点位内存占用较大，建议先从小数量测试。
    </p>
  </section>
</template>

<style lang="scss" scoped>
@use '../../../styles/variables' as *;
@use '../../../styles/mixins' as *;

.load-test {
  @include panel;
  flex: 0 0 auto;
  width: 100%;
  padding: 16px;
  pointer-events: auto;

  &__title {
    margin: 0 0 8px;
    font-size: 15px;
  }

  &__subtitle {
    margin: 16px 0 8px;
    font-size: 13px;
    color: $color-primary;
  }

  &__hint {
    margin: 8px 0 0;
    color: $color-muted;
    font-size: 11px;
    line-height: 1.6;
  }

  &__form {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    margin-top: 12px;

    label {
      display: flex;
      flex-direction: column;
      gap: 4px;
      color: $color-muted;
      font-size: 11px;
    }

    input {
      width: 100%;
      padding: 6px 8px;
      border: 1px solid $color-border;
      border-radius: $radius-sm;
      background: $color-surface-alt;
      color: $color-text;
      font-size: 12px;

      &:focus {
        outline: none;
        border-color: $color-primary;
      }
    }
  }

  &__actions {
    display: flex;
    gap: 8px;
    margin-top: 12px;

    button {
      flex: 1;
      padding: 8px 6px;
      border: 1px solid $color-border;
      border-radius: $radius-sm;
      background: $color-surface-alt;
      color: $color-text;
      font-size: 12px;

      &.is-primary {
        border-color: $color-primary;
        background: rgba($color-primary, 0.18);
        color: $color-primary;
      }

      &:disabled {
        color: $color-muted;
        cursor: not-allowed;
      }
    }
  }

  &__stats {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px 10px;
    margin: 0;

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

  &__progress {
    height: 6px;
    margin-top: 12px;
    border-radius: 999px;
    background: $color-surface-alt;
    overflow: hidden;

    div {
      height: 100%;
      border-radius: 999px;
      background: $color-primary;
      transition: width 0.1s linear;
    }
  }
}
</style>
