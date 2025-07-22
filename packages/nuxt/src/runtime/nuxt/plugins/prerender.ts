import { defineNuxtPlugin, prerenderRoutes } from 'nuxt/app'

export default defineNuxtPlugin({
  setup(nuxtApp) {
    if (!import.meta.prerender) {
      return
    }
    nuxtApp.hooks.hook('app:rendered', (ctx) => {
      let url = ctx.ssrContext?.url || ''
      if (url.endsWith('.md')) {
        return
      }
      if (url.endsWith('/')) {
        url = `${url}index.md`
      }
      else {
        url = `${url}.md`
      }
      prerenderRoutes(url)
    })
  },
})
