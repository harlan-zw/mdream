# @mdream/nuxt

[![npm version][npm-version-src]][npm-version-href]
[![npm downloads][npm-downloads-src]][npm-downloads-href]
[![License][license-src]][license-href]
[![Nuxt][nuxt-src]][nuxt-href]

Nuxt module for converting HTML pages to Markdown using [mdream](https://github.com/harlan-zw/mdream).

## Setup

### Installation

```bash
pnpm add @mdream/nuxt
```

Requires Nuxt 3.0.0 or later.

### Module Registration

```ts
export default defineNuxtConfig({
  modules: ['@mdream/nuxt'],
})
```

Once registered, every route is available as markdown by appending `.md` to the path (e.g., `/about.md`). LLM bots automatically receive markdown responses without the `.md` extension.

## Configuration

All options are configured under the `mdream` key in `nuxt.config.ts`:

```ts
export default defineNuxtConfig({
  modules: ['@mdream/nuxt'],

  mdream: {
    enabled: true,
    mdreamOptions: {
      preset: 'minimal',
      origin: 'https://example.com',
      clean: true,
      frontmatter: true,
      isolateMain: true,
      tailwind: true,
      filter: { exclude: ['nav', 'footer'] },
    },
    cache: {
      maxAge: 3600,
      swr: true,
    },
  },
})
```

### Module Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enabled` | `boolean` | `true` | Enable or disable the module entirely. |
| `mdreamOptions` | `Partial<MdreamOptions> & { preset?: 'minimal' }` | `{ preset: 'minimal' }` | Options passed to `htmlToMarkdown`. See below. |
| `cache.maxAge` | `number` | `3600` | Cache duration in seconds (production only). |
| `cache.swr` | `boolean` | `true` | Enable stale-while-revalidate caching (production only). |

### mdreamOptions

These are passed directly to `htmlToMarkdown` from the `mdream` package.

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `preset` | `'minimal'` | `'minimal'` | Apply the minimal preset (enables frontmatter, isolateMain, tailwind, and filter). |
| `origin` | `string` | Site URL from `nuxt-site-config` | Origin URL for resolving relative image paths and internal links. |
| `clean` | `boolean \| CleanOptions` | `undefined` | Clean up markdown output. Pass `true` for all cleanup or an object for specific features. |
| `frontmatter` | `boolean \| function \| FrontmatterConfig` | `undefined` | Extract frontmatter from the HTML `<head>`. |
| `isolateMain` | `boolean` | `undefined` | Isolate the main content area using semantic HTML. |
| `tailwind` | `boolean` | `undefined` | Convert Tailwind utility classes to semantic markdown. |
| `filter` | `{ include?: string[], exclude?: string[], processChildren?: boolean }` | `undefined` | Filter elements by tag name. |
| `extraction` | `Record<string, (element) => void>` | `undefined` | Extract elements matching CSS selectors during conversion. |
| `tagOverrides` | `Record<string, TagOverride \| string>` | `undefined` | Override how specific HTML tags are converted. |

## Usage

### Content Negotiation

The middleware uses content negotiation to decide whether to serve markdown or HTML:

- Serves markdown when the `Accept` header contains `*/*` or `text/markdown` (but not `text/html`).
- Serves HTML when the `Accept` header contains `text/html` or `sec-fetch-dest` is `document`.

Standard browsers always receive HTML. LLM bots and API clients that do not explicitly request HTML receive markdown.

#### Excluded Paths

The middleware skips these paths:

- Routes starting with `/api`
- Routes starting with `/_`
- Routes starting with `/@`
- Routes with file extensions other than `.md` (e.g., `.js`, `.css`, `.json`)

### Robot Meta Tag Support

Pages with a `noindex` robots meta tag return a 404 when accessed as markdown:

```vue
<script setup>
useHead({
  meta: [
    { name: 'robots', content: 'noindex' }
  ]
})
</script>
```

### Static Generation

When using `nuxt generate` or when `nitro.prerender.routes` is configured, the module automatically:

1. Generates `.md` files alongside HTML for all prerendered pages.
2. Creates `llms.txt` with a page listing (uses site name and description from `nuxt-site-config`).
3. Creates `llms-full.txt` with the full markdown content of all pages.

These files are written to the Nitro public output directory and served as static assets.

## Hooks

Three Nitro runtime hooks (available in server plugins) and one Nuxt build hook (available in `nuxt.config.ts`).

### `mdream:config` (Nitro)

**Type:** `(options: MdreamOptions) => void | Promise<void>`

Modify mdream options before HTML-to-Markdown conversion. Mutate the received object directly.

```ts
// server/plugins/mdream-config.ts
export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('mdream:config', async (options) => {
    options.filter = { exclude: ['nav', 'footer', 'aside'] }
    options.origin = 'https://example.com'
  })
})
```

### `mdream:negotiate` (Nitro)

**Type:** `(ctx: MdreamNegotiateContext) => void | Promise<void>`

Override the content negotiation decision.

```ts
interface MdreamNegotiateContext {
  event: H3Event
  shouldServe: boolean
}
```

```ts
// server/plugins/mdream-negotiate.ts
import { getHeader, getRequestURL } from 'h3'

export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('mdream:negotiate', async (ctx) => {
    if (getHeader(ctx.event, 'x-force-markdown')) {
      ctx.shouldServe = true
    }
    if (getRequestURL(ctx.event).pathname.startsWith('/admin')) {
      ctx.shouldServe = false
    }
  })
})
```

### `mdream:markdown` (Nitro)

**Type:** `(ctx: MdreamMarkdownContext) => void | Promise<void>`

Modify the generated markdown after conversion.

```ts
interface MdreamMarkdownContext {
  html: string
  markdown: string
  route: string
  title: string
  description: string
  isPrerender: boolean
  event: H3Event
}
```

```ts
// server/plugins/mdream-markdown.ts
import { setHeader } from 'h3'

export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('mdream:markdown', async (ctx) => {
    ctx.markdown += '\n\n---\nGenerated with mdream'
    setHeader(ctx.event, 'X-Markdown-Title', ctx.title)
  })
})
```

### `mdream:llms-txt` (Nuxt Build)

**Type:** `(payload: MdreamLlmsTxtGeneratePayload) => void | Promise<void>`

Modify `llms.txt` and `llms-full.txt` content before they are written to disk. Called once during prerendering after all routes have been processed. Mutate the payload properties directly.

```ts
interface MdreamLlmsTxtGeneratePayload {
  content: string // llms.txt content
  fullContent: string // llms-full.txt content
  pages: ProcessedFile[] // All processed pages (read-only)
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

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  modules: ['@mdream/nuxt'],

  hooks: {
    'mdream:llms-txt': async (payload) => {
      payload.content += `\n\n## API\n\nSearch available at /api/search\n`
      payload.fullContent += `\n\n## API Documentation\n\nDetailed docs here...\n`
    },
  },
})
```

## Programmatic Usage

The module auto-imports `htmlToMarkdown` and `streamHtmlToMarkdown` for server routes, and the `useHtmlToMarkdown` composable for client components. Both inherit your module's `mdreamOptions` as defaults.

### Server Routes

`htmlToMarkdown` and `streamHtmlToMarkdown` are auto-imported in all server routes. They wrap the `mdream` package with your module config pre-applied.

```ts
// server/api/convert.post.ts
export default defineEventHandler(async (event) => {
  const { html } = await readBody(event)
  // Uses module's mdreamOptions as defaults
  return htmlToMarkdown(html)
})
```

Per-call options merge over module defaults:

```ts
// server/api/convert-custom.post.ts
export default defineEventHandler(async (event) => {
  const { html } = await readBody(event)
  return htmlToMarkdown(html, { origin: 'https://other.com', clean: true })
})
```

Streaming is also available:

```ts
// server/api/stream.post.ts
export default defineEventHandler(async (event) => {
  const stream = getRequestWebStream(event)
  const chunks = []
  for await (const chunk of streamHtmlToMarkdown(stream)) {
    chunks.push(chunk)
  }
  return chunks.join('')
})
```

### Client Composable

`useHtmlToMarkdown` provides a reactive wrapper for client-side conversion (uses the WASM build automatically). The first argument accepts a string, a ref, or a getter. When the source changes, the markdown is re-converted automatically.

```vue
<script setup>
const html = ref('<h1>Hello</h1>')
const { markdown, pending, error } = useHtmlToMarkdown(html)
</script>

<template>
  <pre v-if="!pending">{{ markdown }}</pre>
</template>
```

On-demand conversion:

```vue
<script setup>
const { markdown, pending, convert } = useHtmlToMarkdown()

async function onPaste(html: string) {
  await convert(html, { origin: 'https://example.com' })
}
</script>
```

The composable returns:

| Property | Type | Description |
|----------|------|-------------|
| `markdown` | `Ref<string>` | The converted markdown output |
| `pending` | `Ref<boolean>` | Whether a conversion is in progress |
| `error` | `ShallowRef<Error \| null>` | Error from the last conversion, if any |
| `convert` | `(html?: string, options?: Partial<MdreamOptions>) => Promise<string>` | Trigger a conversion manually |

## API Reference

### Type Augmentation

The module generates type declarations for all hooks. TypeScript support works automatically in `nuxt.config.ts` and in Nitro plugins.

Augmented modules:

- `@nuxt/schema`: `RuntimeConfig.mdream` and `NuxtHooks['mdream:llms-txt']`
- `nitropack` / `nitropack/types`: `NitroRuntimeHooks` for `mdream:config`, `mdream:negotiate`, and `mdream:markdown`

### Exports

| Entry Point | Contents |
|-------------|----------|
| `@mdream/nuxt` | The Nuxt module itself |
| `@mdream/nuxt/runtime/types` | `MdreamMarkdownContext`, `MdreamNegotiateContext`, `MdreamLlmsTxtGeneratePayload`, `ModuleRuntimeConfig` |

### Auto-imported Server Utils

| Function | Signature | Description |
|----------|-----------|-------------|
| `htmlToMarkdown` | `(html: string, options?: Partial<MdreamOptions>) => string` | Convert HTML to markdown (sync, NAPI) |
| `streamHtmlToMarkdown` | `(stream: ReadableStream, options?: Partial<MdreamOptions>) => AsyncIterable<string>` | Stream HTML to markdown |

### Auto-imported Composables

| Composable | Description |
|------------|-------------|
| `useHtmlToMarkdown` | Reactive HTML to markdown conversion (uses WASM on client) |

## License

[MIT License](./LICENSE)

[npm-version-src]: https://img.shields.io/npm/v/@mdream/nuxt/latest.svg?style=flat&colorA=020420&colorB=00DC82
[npm-version-href]: https://npmjs.com/package/@mdream/nuxt
[npm-downloads-src]: https://img.shields.io/npm/dm/@mdream/nuxt.svg?style=flat&colorA=020420&colorB=00DC82
[npm-downloads-href]: https://npm.chart.dev/@mdream/nuxt
[license-src]: https://img.shields.io/npm/l/@mdream/nuxt.svg?style=flat&colorA=020420&colorB=00DC82
[license-href]: https://npmjs.com/package/@mdream/nuxt
[nuxt-src]: https://img.shields.io/badge/Nuxt-020420?logo=nuxt.js
[nuxt-href]: https://nuxt.com
