import { defineNuxtConfig } from 'nuxt/config'
import MdreamNuxt from '../../packages/nuxt/src/module.ts'

export default defineNuxtConfig({
  modules: [MdreamNuxt],

  // Site configuration for llms.txt generation
  site: {
    name: '@mdream/nuxt Example',
    description: 'Example application demonstrating the @mdream/nuxt module for converting HTML pages to Markdown',
    url: 'https://example.com',
  },

  // Configure the mdream module
  mdream: {
    enabled: true,
    mdreamOptions: {
      // Minimal preset with frontmatter extraction (the module default)
      minimal: true,
    },
  },

  devtools: { enabled: true },
  compatibilityDate: '2024-12-19',
})
