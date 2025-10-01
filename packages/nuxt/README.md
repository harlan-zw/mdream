# @mdream/nuxt

[![npm version][npm-version-src]][npm-version-href]
[![npm downloads][npm-downloads-src]][npm-downloads-href]
[![License][license-src]][license-href]
[![Nuxt][nuxt-src]][nuxt-href]

Nuxt module for converting HTML pages to Markdown using [mdream](https://github.com/unjs/mdream).

Mdream provides a Nuxt module that enables seamless HTML to Markdown conversion for Nuxt 3 applications.

- **🚀 On-Demand Generation**: Access any route with `.md` extension (e.g., `/about` → `/about.md`)
- **📄 LLMs.txt Generation**: Creates `llms.txt` and `llms-full.txt` artifacts during prerendering

### Installation

```bash
npm install @mdream/nuxt
# or
pnpm add @mdream/nuxt
# or
yarn add @mdream/nuxt
```

### Usage

Add the module to your `nuxt.config.ts`:

```ts
export default defineNuxtConfig({
  modules: [
    '@mdream/nuxt'
  ],
})
```

Done! Add the `.md` to any file path to access markdown.

When statically generating your site with `nuxi generate` it will create `llms.txt` artifacts.

## Configuration

Configure the module in your `nuxt.config.ts`:

```ts
export default defineNuxtConfig({
  modules: ['@mdream/nuxt'],

  mdream: {
    // Enable/disable the module
    enabled: true,

    // Pass options to mdream
    mdreamOptions: {
      // mdream conversion options
    },

    // Cache configuration (production only)
    cache: {
      maxAge: 3600, // 1 hour
      swr: true // Stale-while-revalidate
    }
  }
})
```

### Options

- `enabled` (boolean): Enable or disable the module. Default: `true`
- `mdreamOptions` (object): Options passed to mdream's `htmlToMarkdown` function
- `cache.maxAge` (number): Cache duration in seconds. Default: `3600` (1 hour)
- `cache.swr` (boolean): Enable stale-while-revalidate. Default: `true`

## Robot Meta Tag Support

The module respects the `robots` meta tag. Pages with `noindex` will return a 404 error when accessed as markdown:

```vue
<script setup>
useHead({
  meta: [
    { name: 'robots', content: 'noindex' }
  ]
})
</script>
```

## Static Generation

When using `nuxt generate` or static hosting, the module automatically:

1. Generates `.md` files for all pages
2. Creates `llms.txt` with page listings
3. Creates `llms-full.txt` with full content

These files are placed in the `public/` directory and served as static assets.

## Server Hooks

The module provides several hooks for integrating with other modules (e.g., `nuxt-ai-index`):

### `'mdream:config'`{lang="ts"}

**Type:** `(ctx: ConfigContext) => void | Promise<void>`{lang="ts"}

```ts
interface ConfigContext {
  route: string
  options: MdreamOptions
  event: H3Event
}
```

Modify the mdream options before HTML→Markdown conversion. This hook is called during runtime middleware processing, allowing you to dynamically adjust conversion behavior based on the request.

```ts [server/plugins/mdream-config.ts]
export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('mdream:config', async (ctx) => {
    // Apply readability preset for documentation routes
    if (ctx.route.startsWith('/docs')) {
      ctx.options.preset = 'readability'
    }

    // Add custom plugins dynamically
    if (!ctx.options.plugins) {
      ctx.options.plugins = []
    }

    // Filter out advertisements and cookie banners
    ctx.options.plugins.push({
      beforeNodeProcess(event) {
        if (event.node.type === 1) { // ELEMENT_NODE
          const element = event.node
          const classList = element.attributes?.class?.split(' ') || []
          if (classList.includes('advertisement') || classList.includes('cookie-banner')) {
            return { skip: true }
          }
        }
      }
    })
  })
})
```

### `'mdream:markdown'`{lang="ts"}

**Type:** `(ctx: MarkdownContext) => void | Promise<void>`{lang="ts"}

```ts
interface MarkdownContext {
  html: string
  markdown: string
  route: string
  title: string
  description: string
  isPrerender: boolean
  event: H3Event
}
```

Modify the generated markdown content after conversion. Use this hook for post-processing markdown, tracking conversions, or adding custom response headers.

```ts [server/plugins/mdream-markdown.ts]
export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('mdream:markdown', async (ctx) => {
    // Add footer to all markdown output
    ctx.markdown += '\n\n---\n*Generated with mdream*'

    // Track conversion for analytics
    console.log(`Converted ${ctx.route} (${ctx.title})`)

    // Add custom headers
    setHeader(ctx.event, 'X-Markdown-Title', ctx.title)
  })
})
```

## Build Hooks

### `'mdream:llms-txt:generate'`{lang="ts"}

**Type:** `(payload: MdreamLlmsTxtGeneratePayload) => void | Promise<void>`{lang="ts"}

```ts
interface MdreamLlmsTxtGeneratePayload {
  content: string
  fullContent: string
  pages: ProcessedFile[]
}

interface ProcessedFile {
  filePath?: string
  title: string
  content: string
  url: string
  metadata?: {
    title?: string
    description?: string
    keywords?: string
    author?: string
  }
}
```

Modify the llms.txt content before it's written to disk. This hook is called once during prerendering after all routes have been processed. Uses a **mutable pattern** - modify the payload properties directly.

```ts [nuxt.config.ts]
export default defineNuxtConfig({
  modules: ['@mdream/nuxt'],

  hooks: {
    'mdream:llms-txt:generate': async (payload) => {
      // Access all processed pages
      console.log(`Processing ${payload.pages.length} pages`)

      // Add custom sections to llms.txt
      payload.content += `

## API Search

Search available at /api/search with semantic search capabilities.
`

      // Add detailed API documentation to full content
      payload.fullContent += `

## Full API Documentation

Detailed API documentation...
`
    }
  }
})
```

## License

[MIT License](./LICENSE)

<!-- Badges -->
[npm-version-src]: https://img.shields.io/npm/v/@mdream/nuxt/latest.svg?style=flat&colorA=020420&colorB=00DC82
[npm-version-href]: https://npmjs.com/package/@mdream/nuxt

[npm-downloads-src]: https://img.shields.io/npm/dm/@mdream/nuxt.svg?style=flat&colorA=020420&colorB=00DC82
[npm-downloads-href]: https://npm.chart.dev/@mdream/nuxt

[license-src]: https://img.shields.io/npm/l/@mdream/nuxt.svg?style=flat&colorA=020420&colorB=00DC82
[license-href]: https://npmjs.com/package/@mdream/nuxt

[nuxt-src]: https://img.shields.io/badge/Nuxt-020420?logo=nuxt.js
[nuxt-href]: https://nuxt.com
