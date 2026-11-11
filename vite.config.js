import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { viteStaticCopy } from 'vite-plugin-static-copy'

// Cesium 需要把 Build/Cesium 下的静态资源暴露给浏览器运行时
const cesiumSource = 'node_modules/cesium/Build/Cesium'

export default defineConfig({
  plugins: [
    vue(),
    viteStaticCopy({
      targets: ['Assets', 'ThirdParty', 'Workers', 'Widgets'].map((dir) => ({
        src: `${cesiumSource}/${dir}`,
        dest: 'cesium',
      })),
    }),
  ],
  define: {
    CESIUM_BASE_URL: JSON.stringify('/cesium/'),
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
