import { defineNuxtConfig } from 'nuxt/config'
import MdreamNuxt from '../../packages/nuxt/src/module.ts'

export default defineNuxtConfig({
  modules: [MdreamNuxt],

  // Site configuration for llms.txt generation
  // @ts-expect-error untyped
  site: {
    name: '@mdream/nuxt Example',
    description: 'Example application demonstrating the @mdream/nuxt module for converting HTML pages to Markdown',
    url: 'https://example.com',
  },

  // Configure the mdream module
  mdream: {
    enabled: true,
    mdreamOptions: {
      // Use minimal preset with frontmatter extraction
      preset: 'minimal',
    },
    cache: {
      maxAge: 3600, // 1 hour
      swr: true,
    },
  },

  devtools: { enabled: true },
  compatibilityDate: '2024-12-19',
})
