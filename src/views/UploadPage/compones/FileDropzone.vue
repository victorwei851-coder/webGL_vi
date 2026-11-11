<script setup>
import { ref } from 'vue'

const emit = defineEmits(['select'])
const fileInput = ref(null)
const dragging = ref(false)
const accept = '.shp,.shx,.dbf,.prj,.cpg,.geojson,.json,.kml,.gpkg,.zip'

function emitFiles(files) {
  if (files?.length) emit('select', Array.from(files))
}

function onSelect(event) {
  emitFiles(event.target.files)
  event.target.value = ''
}

function onDrop(event) {
  dragging.value = false
  emitFiles(event.dataTransfer?.files)
}
</script>

<template>
  <div
    class="file-dropzone"
    :class="{ 'file-dropzone--active': dragging }"
    @dragover.prevent
    @dragenter.prevent="dragging = true"
    @dragleave.prevent="dragging = false"
    @drop.prevent="onDrop"
  >
    <p class="file-dropzone__title">拖拽文件到这里，或点击选择</p>
    <p class="file-dropzone__hint">
      支持 .shp（可连同同名 .dbf / .shx / .prj）与 .geojson / .json；其它格式暂不解析
    </p>
    <button type="button" class="file-dropzone__button" @click="fileInput.click()">选择文件</button>
    <input
      ref="fileInput"
      class="file-dropzone__input"
      type="file"
      multiple
      :accept="accept"
      @change="onSelect"
    />
  </div>
</template>

<style lang="scss" scoped>
@use '../../../styles/variables' as *;
@use '../../../styles/mixins' as *;

.file-dropzone {
  @include panel;
  margin: 24px 0 32px;
  padding: 40px 24px;
  border-style: dashed;
  text-align: center;
  transition: border-color 0.2s, background 0.2s;

  &--active {
    border-color: $color-primary;
    background: rgba($color-primary, 0.08);
  }

  &__title {
    margin: 0 0 8px;
    font-size: 16px;
  }

  &__hint {
    margin: 0 0 20px;
    color: $color-muted;
    font-size: 13px;
  }

  &__button {
    padding: 10px 22px;
    border: 0;
    border-radius: $radius-sm;
    background: $color-primary;
    color: #06121c;
    font-weight: 600;
  }

  &__input {
    display: none;
  }
}
</style>
