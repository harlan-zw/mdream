import { defineNuxtConfig } from 'nuxt/config'
import MdreamModule from '../../../src/module'

export default defineNuxtConfig({
  modules: [MdreamModule],
  app: {
    head: {
      title: 'Test Fixture',
    },
  },
  mdream: {
    enabled: true,
  },
})
