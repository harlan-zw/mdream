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
    // Note: Hook types are auto-generated in .nuxt/module/nuxt-mdream.d.ts
    // Test mdream:llms-txt:generate hook
    'mdream:llms-txt:generate': (payload: MdreamLlmsTxtGeneratePayload) => {
      console.log('[Hook] mdream:llms-txt:generate called')
      console.log('[Hook] Pages count:', payload.pages.length)

      // Example: Add custom section to llms.txt using mutable pattern
      payload.content += '\n\n## Custom Hook Section\n\nThis was added by a hook!'
      payload.fullContent += '\n\n## Custom Hook Section (Full)\n\nThis was added by a hook!'
    },
  },
})
