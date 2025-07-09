import { createApp } from './main.js'
import './style.css'

const { app, router } = createApp()

// Wait for the router to be ready before mounting to ensure components
// with async setup() have resolved
router.isReady().then(() => {
  app.mount('#app')
})
