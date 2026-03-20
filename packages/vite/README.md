# @mdream/vite

[![npm version][npm-version-src]][npm-version-href]
[![npm downloads][npm-downloads-src]][npm-downloads-href]
[![License][license-src]][license-href]

Vite plugin for HTML to Markdown conversion. Operates at dev time, build time, and preview time.

## Installation

```bash
# pnpm
pnpm add @mdream/vite@beta

# npm
npm install @mdream/vite@beta

# yarn
yarn add @mdream/vite@beta
```

### Peer Dependencies

- `vite` ^4.0.0, ^5.0.0, ^6.0.0, or ^7.0.0

The plugin depends on `mdream` and `@mdream/js` (installed automatically as transitive dependencies).

## Setup

Add the plugin to your `vite.config.ts`:

```ts
import { viteHtmlToMarkdownPlugin } from '@mdream/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [
    viteHtmlToMarkdownPlugin()
  ]
})
```

A default export is also available:

```ts
import htmlToMarkdown from '@mdream/vite'

export default defineConfig({
  plugins: [
    htmlToMarkdown()
  ]
})
```

## Behavior by Vite Mode

### Development (`vite dev`)

Registers middleware via `configureServer` that intercepts incoming requests. When a request matches (see [Request Matching](#request-matching)), the plugin:

1. Resolves the corresponding HTML path by trying multiple candidates in order:
   - `<basePath>.html`
   - `<basePath>` (as-is)
   - `/index.html` (SPA fallback)
2. Runs the HTML through Vite's `transformRequest` pipeline.
3. Converts the result to Markdown using `mdream`.
4. Responds with `Content-Type: text/markdown; charset=utf-8` and `Cache-Control: no-cache`.

### Build (`vite build`)

Uses the `generateBundle` hook to process all HTML assets in the output bundle. For each `.html` file that matches the `include` patterns and does not match `exclude` patterns, the plugin:

1. Converts the HTML source to Markdown.
2. Emits a corresponding `.md` file into the bundle (preserving directory structure).
3. Optionally places the `.md` file under a custom `outputDir`.

### Preview (`vite preview`)

Registers middleware via `configurePreviewServer` that reads built HTML files from the output directory (`dist` by default). Resolution order:

1. `<outDir>/<basePath>.html`
2. `<outDir>/<basePath>/index.html`
3. `<outDir>/index.html` (SPA fallback)

Responses use `Cache-Control: public, max-age=3600`.

## Request Matching

The middleware intercepts a request when either condition is true:

1. **Explicit `.md` extension**: The URL path ends with `.md` (e.g., `/about.md`, `/docs/guide.md`).
2. **Content negotiation**: The client's `Accept` header indicates a preference for `text/markdown` or `text/plain` over `text/html`, as determined by quality weights and position ordering. A bare `*/*` wildcard alone does not trigger Markdown serving. Requests with `Sec-Fetch-Dest: document` are always treated as browser navigation and served HTML.

The following paths are always skipped regardless of extension or headers:

- `/api/*` (API routes)
- `/_*` (internal routes)
- `/@*` (Vite internal routes)
- Any path with a file extension other than `.md` (e.g., `.js`, `.css`, `.html`, `.json`)

### URL Mapping Examples

| Request Path | Resolved HTML |
|---|---|
| `/about.md` | `/about.html` or `/about` or `/index.html` |
| `/docs/guide.md` | `/docs/guide.html` or `/docs/guide` or `/index.html` |
| `/index.md` | `/` (special case: `/index` maps to `/`) |

## API

### Plugin Options

All options are optional. Pass them as an object to the plugin function.

```ts
interface ViteHtmlToMarkdownOptions {
  include?: string[]
  exclude?: string[]
  outputDir?: string
  cacheEnabled?: boolean
  mdreamOptions?: Partial<MdreamOptions>
  cacheTTL?: number
  verbose?: boolean
}
```

#### `include`

- **Type:** `string[]`
- **Default:** `['*.html', '**/*.html']`

Glob patterns controlling which HTML files are processed during `vite build`. Root-level and nested HTML files are included by default. This option does not affect dev or preview middleware (those respond to any matching request).

#### `exclude`

- **Type:** `string[]`
- **Default:** `['**/node_modules/**']`

Glob patterns for HTML files to skip during `vite build`.

#### `outputDir`

- **Type:** `string`
- **Default:** `''` (same directory as the source HTML file)

A subdirectory prefix for generated `.md` files in the build output. For example, setting `outputDir: 'markdown'` would emit `markdown/index.md` instead of `index.md`.

#### `cacheEnabled`

- **Type:** `boolean`
- **Default:** `true`

Enables in-memory caching of converted Markdown for dev and preview servers. Cache entries are keyed by source mode and base path.

#### `cacheTTL`

- **Type:** `number` (milliseconds)
- **Default:** `3600000` (1 hour)

Time-to-live for cache entries. After this duration, entries are evicted on next access and the HTML is re-converted.

#### `mdreamOptions`

- **Type:** `Partial<MdreamOptions>`
- **Default:** `{}`

Options passed directly to `mdream`'s `htmlToMarkdown()` function. Common fields:

| Option | Type | Description |
|---|---|---|
| `origin` | `string` | Base URL for resolving relative image/link paths |
| `minimal` | `boolean` | Enable the minimal preset (frontmatter, isolateMain, tailwind, filter) |
| `clean` | `boolean \| CleanOptions` | Post-processing cleanup. `true` enables all cleanup features |
| `frontmatter` | `boolean \| FrontmatterConfig \| (fm) => void` | Extract metadata from `<head>` as YAML frontmatter |
| `isolateMain` | `boolean` | Isolate main content area using semantic HTML elements |
| `tailwind` | `boolean` | Convert Tailwind utility classes to semantic Markdown |
| `filter` | `{ include?, exclude?, processChildren? }` | Filter out unwanted HTML elements |
| `extraction` | `Record<string, (element) => void>` | Extract elements matching CSS selectors during conversion |
| `tagOverrides` | `Record<string, TagOverride \| string>` | Override or alias tag rendering behavior |

See the [mdream documentation](https://github.com/harlan-zw/mdream/tree/main/packages/mdream) for the full `MdreamOptions` reference.

#### `verbose`

- **Type:** `boolean`
- **Default:** `false`

Log conversion events, cache hits, errors, and file counts to the console. Messages are prefixed with `[vite-html-to-markdown]`.

### Response Headers

The middleware sets the following headers on Markdown responses:

| Header | Value | Description |
|---|---|---|
| `Content-Type` | `text/markdown; charset=utf-8` | MIME type for Markdown content |
| `Cache-Control` | `no-cache` (dev) or `public, max-age=3600` (preview) | Caching strategy per environment |
| `X-Markdown-Source` | `dev`, `preview`, or `build` | Which mode generated the response |
| `X-Markdown-Cached` | `true` or `false` | Whether the response was served from cache |

### Programmatic Usage

The package re-exports `htmlToMarkdown` and `streamHtmlToMarkdown` from `mdream`, so you can use them directly without adding `mdream` as a separate dependency:

```ts
import { htmlToMarkdown } from '@mdream/vite'

const markdown = htmlToMarkdown('<h1>Hello</h1>', {
  origin: 'https://example.com',
  clean: true,
})
```

Streaming conversion:

```ts
import { streamHtmlToMarkdown } from '@mdream/vite'

for await (const chunk of streamHtmlToMarkdown(htmlStream)) {
  process.stdout.write(chunk)
}
```

### Exported Functions

| Function | Signature | Description |
|----------|-----------|-------------|
| `viteHtmlToMarkdownPlugin` | `(options?: ViteHtmlToMarkdownOptions) => Plugin` | Vite plugin for automatic HTML to markdown conversion |
| `htmlToMarkdown` | `(html: string, options?: Partial<MdreamOptions>) => string` | Convert an HTML string to markdown |
| `streamHtmlToMarkdown` | `(stream: ReadableStream, options?: Partial<MdreamOptions>) => AsyncIterable<string>` | Stream HTML to markdown |

### Exported Types

The package exports the following TypeScript types from `@mdream/vite`:

- `MdreamOptions`: Options for `htmlToMarkdown` and `streamHtmlToMarkdown`.
- `ViteHtmlToMarkdownOptions`: Plugin configuration options.
- `CacheEntry`: Internal cache entry shape (`content`, `timestamp`, `ttl`).
- `MarkdownConversionResult`: Result object with `content`, `cached`, and `source` fields.
- `ViteHtmlToMarkdownPlugin`: The plugin function signature.

## Usage Guides

### Minimal Preset with Origin

```ts
import { viteHtmlToMarkdownPlugin } from '@mdream/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [
    viteHtmlToMarkdownPlugin({
      mdreamOptions: {
        minimal: true,
        origin: 'https://example.com',
      }
    })
  ]
})
```

### Scoped Build Output

Only convert docs pages and place the generated Markdown in a dedicated directory:

```ts
import { viteHtmlToMarkdownPlugin } from '@mdream/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [
    viteHtmlToMarkdownPlugin({
      include: ['docs/**/*.html'],
      exclude: ['docs/internal/**'],
      outputDir: 'markdown',
      mdreamOptions: {
        minimal: true,
        origin: 'https://docs.example.com',
        clean: true,
      }
    })
  ]
})
```

### Debug Mode

```ts
import { viteHtmlToMarkdownPlugin } from '@mdream/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [
    viteHtmlToMarkdownPlugin({
      verbose: true,
      cacheEnabled: false,
    })
  ]
})
```

### Extracting Metadata During Build

```ts
import { viteHtmlToMarkdownPlugin } from '@mdream/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [
    viteHtmlToMarkdownPlugin({
      mdreamOptions: {
        frontmatter: {
          metaFields: ['description', 'author', 'keywords'],
          onExtract(fm) {
            console.log('Extracted frontmatter:', fm)
          }
        },
        filter: {
          exclude: ['nav', 'footer', 'aside', 'form'],
        },
      }
    })
  ]
})
```

[npm-version-src]: https://img.shields.io/npm/v/@mdream/vite/latest.svg?style=flat&colorA=18181B&colorB=4C9BE0
[npm-version-href]: https://npmjs.com/package/@mdream/vite
[npm-downloads-src]: https://img.shields.io/npm/dm/@mdream/vite.svg?style=flat&colorA=18181B&colorB=4C9BE0
[npm-downloads-href]: https://npm.chart.dev/@mdream/vite
[license-src]: https://img.shields.io/npm/l/@mdream/vite.svg?style=flat&colorA=18181B&colorB=4C9BE0
[license-href]: https://npmjs.com/package/@mdream/vite
