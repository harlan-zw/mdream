import { defineNuxtConfig } from 'nuxt/config'
import MdreamModule from '../../../src/module'

export default defineNuxtConfig({
  modules: [MdreamModule],
  mdream: {
    enabled: true,
  },
})
