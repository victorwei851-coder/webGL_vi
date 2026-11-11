<script setup>
import { onMounted, reactive, ref, watch } from 'vue'
import huanggangBoundary from '../../../statics/demo1.json'
import snowTextureUrl from '../../../statics/weather/snow.png'
import { summarizeGeoJson } from './geoBoundary'
import { DEFAULT_WEATHER_OPTIONS } from './weather'
import { useThreeScene } from './useThreeScene'
import EffectControlPanel from './compones/EffectControlPanel.vue'
import SceneStatusPanel from './compones/SceneStatusPanel.vue'
import WeatherPanel from './compones/WeatherPanel.vue'

const defaultOptions = Object.freeze({
  autoRotate: true,
  rotationSpeed: 1,
  effects: true,
  interaction: true,
})

const container = ref(null)
const stats = summarizeGeoJson(huanggangBoundary)
const config = reactive({ ...defaultOptions })
const weather = reactive({ ...DEFAULT_WEATHER_OPTIONS })
const { ready, error, init, applyOptions, applyWeather } = useThreeScene(
  container,
  huanggangBoundary,
  config,
  weather,
  snowTextureUrl,
)

onMounted(init)
watch(config, () => applyOptions(config), { deep: true })
watch(weather, () => applyWeather(weather), { deep: true })

function updateOption({ key, value }) {
  if (key in config) config[key] = value
}

function resetOptions() {
  Object.assign(config, defaultOptions)
}

function updateWeather({ key, value }) {
  if (key in weather) weather[key] = value
}

function resetWeather() {
  Object.assign(weather, DEFAULT_WEATHER_OPTIONS)
}
</script>

<template>
  <section class="view three-page">
    <div ref="container" class="three-page__canvas"></div>
    <aside class="three-page__side three-page__side--left">
      <SceneStatusPanel :ready="ready" :error="error" :stats="stats" />
      <WeatherPanel :config="weather" @update="updateWeather" @reset="resetWeather" />
    </aside>
    <aside class="three-page__side three-page__side--right">
      <EffectControlPanel
        :config="config"
        @update="updateOption"
        @reset="resetOptions"
      />
    </aside>
  </section>
</template>

<style lang="scss" scoped>
@use '../../styles/variables' as *;

.three-page {
  overflow: hidden;

  &__canvas {
    position: absolute;
    inset: 0;

    canvas {
      display: block;
    }
  }

  &__side {
    position: absolute;
    z-index: 2;
    top: 16px;
    bottom: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    width: 280px;
    overflow-y: auto;
    scrollbar-width: thin;
    pointer-events: none;

    &--left {
      left: 16px;
    }

    &--right {
      right: 16px;
    }
  }
}

@media (max-width: 900px) {
  .three-page__side {
    left: 16px;
    right: 16px;
    width: auto;
    max-height: 38%;
  }

  .three-page__side--left {
    top: 16px;
    bottom: auto;
  }

  .three-page__side--right {
    top: auto;
    bottom: 16px;
  }
}
</style>
