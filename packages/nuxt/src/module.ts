import type { ModuleOptions, ModuleRuntimeConfig } from './types.js'
import { addServerHandler, addTypeTemplate, createResolver, defineNuxtModule } from '@nuxt/kit'
import { defu } from 'defu'
import { installNuxtSiteConfig } from 'nuxt-site-config/kit'
import { name, version } from '../package.json'
import { setupPrerenderHandler } from './prerender.js'

export default defineNuxtModule<ModuleOptions>({
  meta: {
    name,
    version,
    configKey: 'mdream',
    compatibility: {
      nuxt: '^3.0.0',
    },
  },
  defaults: {
    enabled: true,
    mdreamOptions: {},
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

    // Add type template for runtime config
    addTypeTemplate({
      filename: 'nuxt-mdream.d.ts',
      getContents: () => `
declare module '@nuxt/schema' {
  interface RuntimeConfig {
    mdream: {
      enabled: boolean
      mdreamOptions: Record<string, any>
      cache: {
        maxAge: number
        swr: boolean
      }
    }
  }
}

export {}
      `,
    })

    // Add server middleware for .md extension handling
    addServerHandler({
      middleware: true,
      handler: resolver.resolve('./runtime/server/middleware/mdream'),
    })

    // Setup prerendering hooks for static generation
    const isStatic = nuxt.options.nitro.static || nuxt.options._generate || false
    if (isStatic || nuxt.options.nitro.prerender?.routes?.length) {
      setupPrerenderHandler(runtimeConfig, nuxt)
    }
  },
})
