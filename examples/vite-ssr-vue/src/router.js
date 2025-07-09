import { createMemoryHistory, createRouter, createWebHistory } from 'vue-router'
import About from './components/About.vue'
import Contact from './components/Contact.vue'
import HelloWorld from './components/HelloWorld.vue'

const routes = [
  {
    path: '/',
    name: 'Home',
    component: HelloWorld,
  },
  {
    path: '/about',
    name: 'About',
    component: About,
  },
  {
    path: '/contact',
    name: 'Contact',
    component: Contact,
  },
]

export function createAppRouter() {
  return createRouter({
    history: typeof window !== 'undefined' ? createWebHistory() : createMemoryHistory(),
    routes,
  })
}
