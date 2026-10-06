# @mdream/nuxt

[![npm version][npm-version-src]][npm-version-href]
[![npm downloads][npm-downloads-src]][npm-downloads-href]
[![License][license-src]][license-href]
[![Nuxt][nuxt-src]][nuxt-href]

Nuxt module for converting HTML pages to Markdown using [mdream](https://github.com/harlan-zw/mdream).

## Setup

### Installation

```bash
pnpm add @mdream/nuxt@beta
```

Requires Nuxt 3.0.0 or later.

### Module Registration

```ts
export default defineNuxtConfig({
  modules: ['@mdream/nuxt'],
})
```

Once registered, indexable pages are available as Markdown by appending `.md` to the path, such as `/about.md`.
Bots can omit `.md` when their `Accept` header ranks `text/markdown` or `text/plain` above HTML.

## Migrating from v1

- The `mdreamOptions` default is now `{ minimal: true }`.
  The v1 default was `{ preset: 'minimal' }`. mdream never read `preset`, so the minimal preset did not apply.
- Your `.md` output changes because the minimal preset now applies.
  The output starts with YAML frontmatter.
  The preset removes navigation, footers, forms, and similar elements, and cleans up links.
  The auto-imported `htmlToMarkdown` and `streamHtmlToMarkdown` use the same default.
  To turn the preset off, set `mdreamOptions: { minimal: false }`.
- `mdreamOptions.preset` is removed. If you set it, the build fails. Pass `mdreamOptions: { minimal: true }`.
- The `cache` option is removed. It had no effect, so delete `cache.maxAge` and `cache.swr`.
- An unknown key in `mdreamOptions` throws a `TypeError` when a page converts.

## Configuration

All options are configured under the `mdream` key in `nuxt.config.ts`:

```ts
export default defineNuxtConfig({
  modules: ['@mdream/nuxt'],

  mdream: {
    enabled: true,
    mdreamOptions: {
      minimal: true,
      origin: 'https://example.com',
      filter: { exclude: ['header'] },
    },
  },
})
```

### Module Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enabled` | `boolean` | `true` | Enable or disable the module entirely. |
| `mdreamOptions` | `Partial<MdreamOptions>` | `{ minimal: true }` | Options passed to `htmlToMarkdown`. See below. |

### mdreamOptions

These are passed directly to `htmlToMarkdown` from the `mdream` package.
An unknown key throws a `TypeError` when a page converts.

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `minimal` | `boolean` | `true` | Apply the minimal preset. It enables frontmatter, isolateMain, tailwind, filter, and clean. |
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

- Serves markdown when `text/markdown` or `text/plain` ranks above HTML in the `Accept` header.
- Serves HTML for wildcard headers, missing headers, or browser navigation (`sec-fetch-dest: document`).

Use the `.md` extension or explicitly request Markdown. Unsupported media types receive HTTP 406 on HTML routes.

#### Excluded Paths

The middleware skips these paths:

- Routes starting with `/api`
- Routes starting with `/_`
- Routes starting with `/@`
- Routes with file extensions other than `.md` (e.g., `.js`, `.css`, `.json`)

### Robot Meta Tag Support

Pages with a `noindex` robots meta tag return a 404 when accessed as markdown:

```vue
<script setup lang="ts">
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
  const stream = getRequestWebStream(event) ?? null
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
<script setup lang="ts">
const html = ref('<h1>Hello</h1>')
const { markdown, pending, error } = useHtmlToMarkdown(html)
</script>

<template>
  <pre v-if="!pending">{{ markdown }}</pre>
</template>
```

On-demand conversion:

```vue
<script setup lang="ts">
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

[npm-version-src]: https://img.shields.io/npm/v/@mdream/nuxt/beta.svg?style=flat&colorA=020420&colorB=00DC82
[npm-version-href]: https://npmjs.com/package/@mdream/nuxt/v/beta
[npm-downloads-src]: https://img.shields.io/npm/dm/@mdream/nuxt.svg?style=flat&colorA=020420&colorB=00DC82
[npm-downloads-href]: https://npm.chart.dev/@mdream/nuxt
[license-src]: https://img.shields.io/npm/l/@mdream/nuxt.svg?style=flat&colorA=020420&colorB=00DC82
[license-href]: https://npmjs.com/package/@mdream/nuxt
[nuxt-src]: https://img.shields.io/badge/Nuxt-020420?logo=nuxt.js
[nuxt-href]: https://nuxt.com
