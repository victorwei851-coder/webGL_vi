<script setup>
import { RouterLink, RouterView } from 'vue-router'
import { tianditu } from '@/config/map'

const navLinks = [
  { to: '/', label: '主页' },
  { to: '/cesium', label: 'Cesium 地图' },
  { to: '/three', label: 'Three.js 板块' },
  { to: '/upload', label: '上传管理' },
]
</script>

<template>
  <div class="app-shell">
    <header class="app-header">
      <RouterLink class="brand" to="/">
        <span class="brand__mark"></span>
        WebGL 地图可视化
      </RouterLink>

      <nav class="app-nav" aria-label="主导航">
        <RouterLink
          v-for="link in navLinks"
          :key="link.to"
          :to="link.to"
          class="app-nav__link"
        >
          {{ link.label }}
        </RouterLink>
      </nav>

      <span class="key-badge" :class="{ 'key-badge--ok': tianditu.ready }">
        <span class="key-badge__dot"></span>
        天地图 Key {{ tianditu.ready ? '已配置' : '未配置' }}
      </span>
    </header>

    <main class="app-main">
      <RouterView />
    </main>
  </div>
</template>

<style lang="scss" scoped>
@use './styles/variables' as *;

.app-shell {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.app-header {
  display: flex;
  flex: 0 0 $header-height;
  align-items: center;
  gap: 28px;
  height: $header-height;
  padding: 0 24px;
  border-bottom: 1px solid $color-border;
  background: $color-surface;
}

.brand {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  flex: 0 0 auto;
  font-weight: 600;
  letter-spacing: 0.5px;

  &__mark {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: $color-primary;
    box-shadow: 0 0 12px $color-primary;
  }
}

.app-nav {
  display: flex;
  flex: 1;
  gap: 6px;

  &__link {
    padding: 8px 14px;
    border-radius: $radius-sm;
    color: $color-muted;
    font-size: 14px;
    transition: background 0.2s, color 0.2s;

    &:hover {
      background: $color-surface-alt;
      color: $color-text;
    }

    &.router-link-exact-active {
      background: rgba($color-primary, 0.14);
      color: $color-primary;
    }
  }
}

.key-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  flex: 0 0 auto;
  padding: 6px 12px;
  border: 1px solid $color-border;
  border-radius: 999px;
  color: $color-warn;
  font-size: 12px;

  &__dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: currentColor;
  }

  &--ok {
    color: $color-accent;
  }
}

.app-main {
  position: relative;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

@media (max-width: 760px) {
  .app-header {
    flex-wrap: wrap;
    gap: 8px;
    height: auto;
    padding: 12px 16px;
  }

  .app-nav {
    order: 3;
    width: 100%;
    overflow-x: auto;
  }

  .key-badge {
    margin-left: auto;
  }
}
</style>
