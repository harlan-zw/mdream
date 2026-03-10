import type { ModuleOptions, ModuleRuntimeConfig } from './types.js'
import { addPlugin, addServerHandler, createResolver, defineNuxtModule } from '@nuxt/kit'
import { defu } from 'defu'
import { installNuxtSiteConfig } from 'nuxt-site-config/kit'
import { name, version } from '../package.json'
import { setupPrerenderHandler } from './prerender.js'
import { registerTypeTemplates } from './templates.js'

export default defineNuxtModule<ModuleOptions>({
  meta: {
    name,
    version,
    configKey: 'mdream',
    compatibility: {
      nuxt: '>=3.0.0',
    },
  },
  defaults: {
    enabled: true,
    mdreamOptions: {
      preset: 'minimal',
    },
    cache: {
      maxAge: 3600, // 1 hour
      swr: true,
    },
  },
  async setup(options, nuxt) {
    if (!options.enabled) {
      return
    }

    const resolver = createResolver(import.meta.url)

    // Install site config for accessing site name and description
    await installNuxtSiteConfig()

    // Prepare runtime config
    const runtimeConfig: ModuleRuntimeConfig = {
      enabled: options.enabled,
      mdreamOptions: options.mdreamOptions,
      cache: defu(options.cache, {
        maxAge: 3600,
        swr: true,
      }) as Required<NonNullable<ModuleOptions['cache']>>,
    }

    // Add runtime config
    nuxt.options.runtimeConfig.mdream = defu(
      nuxt.options.runtimeConfig.mdream as any,
      runtimeConfig,
    )

    registerTypeTemplates()

    // Add server middleware for .md extension handling
    addServerHandler({
      middleware: true,
      handler: resolver.resolve('./runtime/server/middleware/mdream'),
    })

    if (nuxt.options.build) {
      addPlugin({ mode: 'server', src: resolver.resolve('./runtime/nuxt/plugins/prerender') })
    }

    // Setup prerendering hooks for static generation
    // @ts-expect-error untyped
    const isStatic = nuxt.options.nitro.static || nuxt.options._generate || false
    if (isStatic || nuxt.options.nitro.prerender?.routes?.length) {
      setupPrerenderHandler()
    }
  },
})
