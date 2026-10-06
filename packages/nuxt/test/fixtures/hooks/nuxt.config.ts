import type { MdreamLlmsTxtGeneratePayload } from '../../../src/types'
import { defineNuxtConfig } from 'nuxt/config'
import MdreamModule from '../../../src/module'

export default defineNuxtConfig({
  modules: [MdreamModule],
  mdream: {
    enabled: true,
  },
  nitro: {
    prerender: {
      routes: ['/'],
    },
  },
  hooks: {
    'mdream:llms-txt': (payload: MdreamLlmsTxtGeneratePayload) => {
      console.log('[Hook] mdream:llms-txt called')
      console.log('[Hook] Pages count:', payload.pages.length)

      // Example: Add custom section to llms.txt using mutable pattern
      payload.content += '\n\n## Custom Hook Section\n\nThis was added by a hook!'
      payload.fullContent += '\n\n## Custom Hook Section (Full)\n\nThis was added by a hook!'
    },
  },
})
