import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      component: () => import('@/views/HomeView.vue'),
    },
    {
      path: '/demo',
      component: () => import('@/views/X6Demo.vue'),
    },
    {
      path: '/new',
      component: () => import('@/views/NewDemo.vue'),
    },
  ],
})

export default router
