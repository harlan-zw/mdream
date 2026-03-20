import type { ModuleOptions, ModuleRuntimeConfig } from './types.js'
import { addImportsDir, addPlugin, addServerHandler, addServerImportsDir, createResolver, defineNuxtModule } from '@nuxt/kit'
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

    // Externalize mdream for Node.js presets so the NAPI native binding works.
    // The .node loader uses createRequire(import.meta.url) which breaks when
    // Nitro bundles the code (import.meta.url points to the output bundle).
    //
    // Edge presets (cloudflare, vercel-edge, etc.) set exportConditions to
    // "workerd" or "edge-light", which resolves to the WASM build. These
    // presets must bundle mdream so the WASM binary is included in the output.
    //
    // We use rollupConfig.external instead of externals.external because Nitro's
    // externals plugin relies on parseNodeModulePath which fails for pnpm workspace
    // symlinked packages (resolved path has no node_modules/ segment).
    const edgePresets = new Set([
      'cloudflare',
      'cloudflare-pages',
      'cloudflare-module',
      'cloudflare-durable',
      'vercel-edge',
      'netlify-edge',
      'deno',
      'deno-deploy',
      'deno-server',
      'lagon',
      'winterjs',
      'bun',
    ])
    nuxt.hook('nitro:config', (nitroConfig) => {
      const preset = (nitroConfig.preset || '').toString()
      if (edgePresets.has(preset)) {
        // Enable experimental.wasm so Nitro's unwasm plugin handles .wasm imports
        // from the mdream edge entry point (dist/edge.mjs → wasm/mdream_edge_bg.wasm)
        nitroConfig.experimental = nitroConfig.experimental || {}
        nitroConfig.experimental.wasm = true
        return
      }
      nitroConfig.rollupConfig = nitroConfig.rollupConfig || {}
      const mdreamRe = /^(?:mdream(?:\/|$)|@mdream\/rust-)/
      const existing = nitroConfig.rollupConfig.external
      if (Array.isArray(existing)) {
        existing.push(mdreamRe)
      }
      else {
        nitroConfig.rollupConfig.external = existing
          ? [existing as string | RegExp, mdreamRe]
          : [mdreamRe]
      }
    })

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

    // Auto-import htmlToMarkdown / streamHtmlToMarkdown in server routes
    addServerImportsDir(resolver.resolve('./runtime/server/utils'))

    // Auto-import useHtmlToMarkdown composable in app code
    addImportsDir(resolver.resolve('./runtime/nuxt/composables'))

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
