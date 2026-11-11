import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    name: 'home',
    component: () => import('@/views/HomePage/index.vue'),
    meta: { title: '主页' },
  },
  {
    path: '/cesium',
    name: 'cesium',
    component: () => import('@/views/CesiumPage/index.vue'),
    meta: { title: 'Cesium 地图边界' },
  },
  {
    path: '/three',
    name: 'three',
    component: () => import('@/views/ThreePage/index.vue'),
    meta: { title: 'Three.js 板块模型' },
  },
  {
    path: '/upload',
    name: 'upload',
    component: () => import('@/views/UploadPage/index.vue'),
    meta: { title: '上传管理' },
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/',
  },
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})

router.afterEach((to) => {
  document.title = `${to.meta.title ?? '地图可视化'} · WebGL VI`
})

export default router
