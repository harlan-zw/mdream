# mdream

[![npm version](https://img.shields.io/npm/v/mdream?color=yellow)](https://npmjs.com/package/mdream)
[![npm downloads](https://img.shields.io/npm/dm/mdream?color=yellow)](https://npm.chart.dev/mdream)
[![license](https://img.shields.io/github/license/harlan-zw/mdream?color=yellow)](https://github.com/harlan-zw/mdream/blob/main/LICENSE.md)

## Installation

```bash
# npm
npm install mdream

# pnpm
pnpm add mdream

# yarn
yarn add mdream
```

For the JavaScript-only engine (hook-based plugins, splitter, pure HTML parser):

```bash
pnpm add @mdream/js
```

### Bundler Compatibility

The `mdream` package uses native Node.js bindings (NAPI-RS) which cannot be statically bundled. If your bundler fails to resolve `mdream`, mark it as external:

**Next.js / Turbopack:**
```js
// next.config.js
const nextConfig = {
  serverExternalPackages: ['mdream'],
}
```

**Webpack / other bundlers:**
```js
externals: ['mdream']
```

> [!TIP]
> [`@mdream/js`](https://github.com/harlan-zw/mdream/tree/main/packages/js) has zero native dependencies and works with all bundlers without configuration.

> [!TIP]
> Using Vite? [`@mdream/vite`](https://github.com/harlan-zw/mdream/tree/main/packages/vite) handles this automatically.

## Table of Contents

- [API Reference](#api-reference)
  - [htmlToMarkdown()](#htmltomarkdown)
  - [streamHtmlToMarkdown()](#streamhtmltomarkdown)
- [Engines](#engines)
- [Options](#options)
  - [MdreamOptions (Rust engine)](#mdreamoptions-rust-engine)
  - [MdreamOptions (JS engine)](#mdreamoptions-js-engine)
  - [CleanOptions](#cleanoptions)
  - [FrontmatterConfig](#frontmatterconfig)
  - [TagOverride](#tagoverride)
  - [FilterOptions](#filteroptions)
- [Presets](#presets)
  - [Minimal Preset](#minimal-preset)
- [Built-in Plugins](#built-in-plugins)
  - [Frontmatter](#frontmatter-plugin)
  - [Isolate Main](#isolate-main-plugin)
  - [Tailwind](#tailwind-plugin)
  - [Filter](#filter-plugin)
  - [Extraction](#extraction-plugin)
- [Hook-Based Plugins (JS Engine)](#hook-based-plugins-js-engine)
  - [Plugin Hooks](#plugin-hooks)
  - [createPlugin()](#createplugin)
- [Markdown Splitting (JS Engine)](#markdown-splitting-js-engine)
  - [Basic Chunking](#basic-chunking)
  - [Streaming Chunks](#streaming-chunks-memory-efficient)
  - [Splitter Options](#splitter-options)
  - [Chunk Metadata](#chunk-metadata)
- [Content Negotiation](#content-negotiation)
- [Pure HTML Parser (JS Engine)](#pure-html-parser-js-engine)
- [CLI Usage](#cli-usage)
- [Browser and Edge Usage](#browser-and-edge-usage)
  - [Edge / Cloudflare Workers](#edge--cloudflare-workers)
  - [Browser CDN (IIFE)](#browser-cdn-iife)
  - [Web Worker](#web-worker)
- [llms.txt Generation](#llmstxt-generation)
- [Related Packages](#related-packages)

## API Reference

### `htmlToMarkdown()`

Converts a complete HTML string to Markdown synchronously.

**Rust engine** (`mdream`):

```ts
import { htmlToMarkdown } from 'mdream'

function htmlToMarkdown(html: string, options?: Partial<MdreamOptions>): string
```

**JS engine** (`@mdream/js`):

```ts
import { htmlToMarkdown } from '@mdream/js'

function htmlToMarkdown(html: string, options?: Partial<MdreamOptions>): string
```

**Example:**

```ts
import { htmlToMarkdown } from 'mdream'

const markdown = htmlToMarkdown('<h1>Hello World</h1><p>Some content.</p>')
// # Hello World
//
// Some content.
```

### `streamHtmlToMarkdown()`

Converts an HTML `ReadableStream` to Markdown incrementally. Returns an `AsyncIterable<string>` that yields Markdown chunks as they are processed.


```ts
import { streamHtmlToMarkdown } from 'mdream'

function streamHtmlToMarkdown(
  htmlStream: ReadableStream<Uint8Array | string> | null,
  options?: Partial<MdreamOptions>,
): AsyncIterable<string>
```


**Example:**

```ts
import { streamHtmlToMarkdown } from 'mdream'

const response = await fetch('https://example.com')
const stream = response.body

for await (const chunk of streamHtmlToMarkdown(stream, {
  origin: 'https://example.com',
})) {
  process.stdout.write(chunk)
}
```

## Engines

Mdream includes two rendering engines, automatically selecting the best one for your environment:

| Engine | Package | Plugins | Use case |
|--------|---------|---------|----------|
| **Rust** (NAPI) | `mdream` | Declarative config only | Node.js (default) |
| **Rust** (WASM) | `mdream` | Declarative config only | Edge, browser |
| **JavaScript** | `@mdream/js` | Hook-based + declarative | Custom plugins, splitter |

```ts
// JavaScript engine (required for hook-based plugins)
import { htmlToMarkdown } from '@mdream/js'

// Rust NAPI engine (auto-selected in Node.js)
import { htmlToMarkdown } from 'mdream'
```

Both engines accept the same declarative plugin configuration (`origin`, `minimal`, `frontmatter`, `isolateMain`, `tailwind`, `filter`, `extraction`, `tagOverrides`, `clean`). The JS engine additionally supports `hooks` for imperative plugin transforms.

## Options

### MdreamOptions (Rust engine)

Defined in `mdream`:

```ts
interface MdreamOptions {
  /** Base URL for resolving relative links and images. */
  origin?: string

  /**
   * Enable minimal preset (frontmatter, isolateMain, tailwind, filter).
   * Default: false
   */
  minimal?: boolean

  /**
   * Post-processing cleanup. Pass `true` for all cleanup, or an object for specific features.
   * Enabled by default when `minimal` is true.
   */
  clean?: boolean | CleanOptions

  /**
   * Extract frontmatter from HTML <head>.
   * - `true`: enable with defaults
   * - `(fm) => void`: enable and receive structured data via callback
   * - `FrontmatterConfig`: enable with config and optional callback
   */
  frontmatter?: boolean | ((frontmatter: Record<string, string>) => void) | FrontmatterConfig

  /** Isolate main content area. Default when minimal: true */
  isolateMain?: boolean

  /** Convert Tailwind utility classes to Markdown. Default when minimal: true */
  tailwind?: boolean

  /** Filter elements by CSS selectors. Default when minimal: excludes form, nav, footer, etc. */
  filter?: { include?: string[], exclude?: string[], processChildren?: boolean }

  /** Extract elements matching CSS selectors during conversion. */
  extraction?: Record<string, (element: ExtractedElement) => void>

  /** Override tag rendering behavior. String values act as aliases. */
  tagOverrides?: Record<string, TagOverride | string>
}
```

### MdreamOptions (JS engine)

The JS engine extends the shared `EngineOptions` with hook-based plugin support:

```ts
interface MdreamOptions extends EngineOptions {
  /** Imperative hook-based transform plugins. JS engine only. */
  hooks?: TransformPlugin[]
}

interface EngineOptions {
  origin?: string
  clean?: boolean | CleanOptions
  plugins?: BuiltinPlugins
}

interface BuiltinPlugins {
  filter?: { include?: (string | number)[], exclude?: (string | number)[], processChildren?: boolean }
  frontmatter?: boolean | ((fm: Record<string, string>) => void) | FrontmatterConfig
  isolateMain?: boolean
  tailwind?: boolean
  extraction?: Record<string, (element: ExtractedElement) => void>
  tagOverrides?: Record<string, TagOverride | string>
}
```

Note: The JS engine uses `options.plugins.filter` while the Rust engine uses `options.filter` directly.

### CleanOptions

Post-processing cleanup applied to the final Markdown output. All options default to `false` unless `clean: true` is set.

```ts
interface CleanOptions {
  /** Strip tracking query parameters (utm_*, fbclid, gclid, etc.) from URLs */
  urls?: boolean
  /** Strip fragment-only links that don't match any heading in the output */
  fragments?: boolean
  /** Strip links with meaningless hrefs (#, javascript:void(0)) to plain text */
  emptyLinks?: boolean
  /** Collapse 3+ consecutive blank lines to 2 */
  blankLines?: boolean
  /** Strip links where text equals URL: [https://x.com](https://x.com) becomes https://x.com */
  redundantLinks?: boolean
  /** Strip self-referencing heading anchors: ## [Title](#title) becomes ## Title */
  selfLinkHeadings?: boolean
  /** Strip images with no alt text (decorative/tracking pixels) */
  emptyImages?: boolean
  /** Drop links that produce no visible text: [](url) is removed entirely */
  emptyLinkText?: boolean
}
```

**Example:**

```ts
const markdown = htmlToMarkdown(html, {
  clean: {
    urls: true,
    emptyLinks: true,
    emptyImages: true,
  },
})
```

### FrontmatterConfig

```ts
interface FrontmatterConfig {
  /** Additional static fields to include in frontmatter */
  additionalFields?: Record<string, string>
  /**
   * Meta tag names to extract beyond the defaults.
   * Defaults: description, keywords, author, date,
   * og:title, og:description, twitter:title, twitter:description
   */
  metaFields?: string[]
  /** Callback to receive structured frontmatter data after conversion */
  onExtract?: (frontmatter: Record<string, string>) => void
}
```

### TagOverride

Override how specific HTML tags are rendered in Markdown. String values act as aliases.

```ts
interface TagOverride {
  /** Markdown string to insert when entering this tag */
  enter?: string
  /** Markdown string to insert when exiting this tag */
  exit?: string
  /** Spacing: [newlines before, newlines after] */
  spacing?: number[]
  /** Whether this tag should be treated as inline */
  isInline?: boolean
  /** Whether this tag is self-closing */
  isSelfClosing?: boolean
  /** Whether whitespace inside this tag should be collapsed */
  collapsesInnerWhiteSpace?: boolean
  /** Alias this tag to another tag's handler */
  alias?: string
}
```

**Example:**

```ts
const markdown = htmlToMarkdown(html, {
  tagOverrides: {
    // Treat <x-heading> like <h2>
    'x-heading': 'h2',
    // Custom rendering for <callout>
    'callout': {
      enter: '> **Note:** ',
      exit: '',
      spacing: [2, 2],
    },
  },
})
```

### FilterOptions

```ts
interface FilterOptions {
  /** CSS selectors, tag names, or TAG_* constants for elements to include (all others excluded) */
  include?: (string | number)[]
  /** CSS selectors, tag names, or TAG_* constants for elements to exclude */
  exclude?: (string | number)[]
  /** Whether to also process children of matched elements. Default: true */
  processChildren?: boolean
}
```

## Presets

### Minimal Preset

The `minimal` preset enables the following plugins together:

- **frontmatter**: Extracts metadata from HTML `<head>` into YAML frontmatter
- **isolateMain**: Extracts the main content area, skipping navigation, headers, and footers
- **tailwind**: Converts Tailwind utility classes to Markdown formatting
- **filter**: Excludes `form`, `fieldset`, `object`, `embed`, `footer`, `aside`, `iframe`, `input`, `textarea`, `select`, `button`, `nav`
- **clean**: All post-processing cleanup enabled

**Rust engine:**

```ts
import { htmlToMarkdown } from 'mdream'

const markdown = htmlToMarkdown(html, {
  origin: 'https://example.com',
  minimal: true,
})
```

**JS engine (using `withMinimalPreset`):**

```ts
import { htmlToMarkdown } from '@mdream/js'
import { withMinimalPreset } from '@mdream/js/preset/minimal'

const markdown = htmlToMarkdown(html, withMinimalPreset({
  origin: 'https://example.com',
}))
```

`withMinimalPreset()` returns an `EngineOptions` object with all plugin defaults applied. You can override individual plugins:

```ts
const markdown = htmlToMarkdown(html, withMinimalPreset({
  plugins: {
    frontmatter: false,
    filter: { exclude: ['nav'] },
  },
}))
```

## Built-in Plugins

All built-in plugins work with both the Rust and JS engines through declarative configuration.

### Frontmatter Plugin

Extracts metadata from the HTML `<head>` element and generates YAML frontmatter.

**Extracted fields by default:** `title`, `description`, `keywords`, `author`, `date`, `og:title`, `og:description`, `twitter:title`, `twitter:description`.

```ts
// Enable with defaults
htmlToMarkdown(html, { frontmatter: true })

// With callback to receive structured data
htmlToMarkdown(html, {
  frontmatter: (fm) => {
    console.log(fm.title)
    console.log(fm.description)
  },
})

// With full config
htmlToMarkdown(html, {
  frontmatter: {
    additionalFields: { source: 'https://example.com' },
    metaFields: ['robots', 'viewport'],
    onExtract: fm => console.log(fm),
  },
})
```

**Output example:**

```yaml
---
title: My Page Title
meta:
  description: A page description
  'og:title': My Page Title
---
```

### Isolate Main Plugin

Isolates the main content area using the following priority:

1. If an explicit `<main>` element exists (within 5 depth levels), use its content exclusively
2. Otherwise, find content between the first header tag (`h1`-`h6`) and the first `<footer>`
3. Headings inside `<header>` tags are skipped during fallback detection
4. The `<head>` section is always passed through for other plugins (e.g., frontmatter)

```ts
htmlToMarkdown(html, { isolateMain: true })
```

### Tailwind Plugin

Converts Tailwind CSS utility classes to semantic Markdown formatting:

| Tailwind Class | Markdown Output |
|---|---|
| `font-bold`, `font-semibold`, `font-medium`, `font-extrabold`, `font-black` | `**bold**` |
| `italic`, `font-italic` | `*italic*` |
| `line-through` | `~~strikethrough~~` |
| `hidden`, `invisible` | Content removed |
| `absolute`, `fixed`, `sticky` | Content removed |

Supports responsive breakpoint prefixes (`sm:`, `md:`, `lg:`, `xl:`, `2xl:`) with mobile-first resolution.

```ts
htmlToMarkdown(html, { tailwind: true })
```

### Filter Plugin

Filters HTML elements by CSS selectors, tag names, or `TAG_*` constants.

```ts
// Exclude navigation, sidebar, footer
htmlToMarkdown(html, {
  filter: {
    exclude: ['nav', '#sidebar', '.footer', 'aside'],
  },
})

// Include only specific elements
htmlToMarkdown(html, {
  filter: {
    include: ['article', 'main'],
  },
})
```

The JS engine also supports `TAG_*` integer constants for filtering:

```ts
import { TAG_FOOTER, TAG_NAV } from '@mdream/js'

htmlToMarkdown(html, {
  plugins: {
    filter: { exclude: [TAG_NAV, TAG_FOOTER] },
  },
})
```

Elements with `style="position: absolute"` or `style="position: fixed"` are also automatically excluded when the filter plugin is active.

### Extraction Plugin

Extracts elements matching CSS selectors during conversion. Callbacks receive the matched element with its accumulated text content and attributes.

```ts
htmlToMarkdown(html, {
  extraction: {
    'h2': (el) => {
      console.log('Heading:', el.textContent)
    },
    'img[alt]': (el) => {
      console.log('Image:', el.attributes.src, el.attributes.alt)
    },
    'a[href]': (el) => {
      console.log('Link:', el.textContent, el.attributes.href)
    },
  },
})
```

The `ExtractedElement` interface:

```ts
interface ExtractedElement {
  selector: string
  tagName: string
  textContent: string
  attributes: Record<string, string>
}
```

## Hook-Based Plugins (JS Engine)

The JS engine (`@mdream/js`) supports imperative hook-based plugins for custom transform logic. These allow you to intercept and modify the conversion pipeline at multiple stages.

```ts
import { htmlToMarkdown } from '@mdream/js'
import { createPlugin } from '@mdream/js/plugins'

const myPlugin = createPlugin({
  onNodeEnter(node) {
    if (node.name === 'h1')
      return '** '
  },
  processTextNode(textNode) {
    if (textNode.parent?.attributes?.id === 'highlight') {
      return { content: `**${textNode.value}**`, skip: false }
    }
  },
})

const markdown = htmlToMarkdown(html, { hooks: [myPlugin] })
```

### Plugin Hooks

```ts
interface TransformPlugin {
  /**
   * Called before any node processing. Return { skip: true } to skip the node.
   */
  beforeNodeProcess?: (
    event: NodeEvent,
    state: MdreamRuntimeState,
  ) => undefined | void | { skip: boolean }

  /**
   * Called when entering an element node.
   * Return a string to prepend to the output.
   */
  onNodeEnter?: (
    node: ElementNode,
    state: MdreamRuntimeState,
  ) => string | undefined | void

  /**
   * Called when exiting an element node.
   * Return a string to append to the output.
   */
  onNodeExit?: (
    node: ElementNode,
    state: MdreamRuntimeState,
  ) => string | undefined | void

  /**
   * Called to process element attributes (e.g., extracting Tailwind classes).
   */
  processAttributes?: (
    node: ElementNode,
    state: MdreamRuntimeState,
  ) => void

  /**
   * Called for each text node. Return { content, skip } to transform text.
   * Return undefined for no transformation.
   */
  processTextNode?: (
    node: TextNode,
    state: MdreamRuntimeState,
  ) => { content: string, skip: boolean } | undefined
}
```

### `createPlugin()`

A typed identity function for creating plugins with full TypeScript inference:

```ts
import { createPlugin } from '@mdream/js/plugins'

const plugin = createPlugin({
  beforeNodeProcess({ node }) {
    // Skip all div elements with class "ad"
    if (node.type === 1 && node.attributes?.class?.includes('ad')) {
      return { skip: true }
    }
  },
})
```

### Built-in Plugin Functions (JS Engine)

The following plugin factory functions are available from `@mdream/js/plugins`:

```ts
import {
  createPlugin,
  extractionCollectorPlugin,
  extractionPlugin,
  filterPlugin,
  frontmatterPlugin,
  isolateMainPlugin,
  tailwindPlugin,
} from '@mdream/js/plugins'
```

## Markdown Splitting (JS Engine)

Split HTML into Markdown chunks during conversion. Compatible with the LangChain `Document` structure.

Available from `@mdream/js/splitter`.

### Basic Chunking

```ts
import { TAG_H2 } from '@mdream/js'
import { htmlToMarkdownSplitChunks } from '@mdream/js/splitter'

const html = `
  <h1>Documentation</h1>
  <h2>Installation</h2>
  <p>Install via npm...</p>
  <h2>Usage</h2>
  <p>Use it like this...</p>
`

const chunks = htmlToMarkdownSplitChunks(html, {
  headersToSplitOn: [TAG_H2],
  chunkSize: 1000,
  chunkOverlap: 200,
  stripHeaders: true,
})

chunks.forEach((chunk) => {
  console.log(chunk.content)
  console.log(chunk.metadata.headers) // { h1: "Documentation", h2: "Installation" }
  console.log(chunk.metadata.code) // Language if chunk contains code
  console.log(chunk.metadata.loc) // { lines: { from: 1, to: 5 } }
})
```

### Streaming Chunks (Memory Efficient)

For large documents, use the generator version to process chunks one at a time:

```ts
import { htmlToMarkdownSplitChunksStream } from '@mdream/js/splitter'

for (const chunk of htmlToMarkdownSplitChunksStream(html, options)) {
  await processChunk(chunk)

  // Early termination supported
  if (foundTarget)
    break
}
```

### Splitter Options

```ts
interface SplitterOptions {
  // --- Structural splitting ---

  /**
   * Header tag IDs to split on (TAG_H1 through TAG_H6).
   * Default: [TAG_H2, TAG_H3, TAG_H4, TAG_H5, TAG_H6]
   */
  headersToSplitOn?: number[]

  // --- Size-based splitting ---

  /** Maximum chunk size in characters. Default: 1000 */
  chunkSize?: number

  /** Overlap between chunks for context preservation. Default: 200 */
  chunkOverlap?: number

  /**
   * Custom length function (e.g., a token counter for LLM applications).
   * Default: (text) => text.length
   */
  lengthFunction?: (text: string) => number

  // --- Output formatting ---

  /** Remove headers from chunk content. Default: true */
  stripHeaders?: boolean

  /** Split into individual lines. Default: false */
  returnEachLine?: boolean

  /** Keep separators in the split chunks. Default: false */
  keepSeparator?: boolean

  // --- Standard options ---

  /** Base URL for resolving relative links/images */
  origin?: string

  /** Declarative built-in plugin config */
  plugins?: BuiltinPlugins

  /** Hook-based plugins (JS engine only) */
  hooks?: TransformPlugin[]

  /** Post-processing cleanup */
  clean?: boolean | CleanOptions
}
```

### Chunk Metadata

Each chunk includes metadata for context:

```ts
interface MarkdownChunk {
  content: string
  metadata: {
    /** Header hierarchy at this chunk position */
    headers?: Record<string, string> // { h1: "Title", h2: "Section" }
    /** Code block language if chunk contains code */
    code?: string
    /** Line number range in the original document */
    loc?: {
      lines: { from: number, to: number }
    }
  }
}
```

### Use with Presets

Combine splitting with presets:

```ts
import { TAG_H2 } from '@mdream/js'
import { withMinimalPreset } from '@mdream/js/preset/minimal'
import { htmlToMarkdownSplitChunks } from '@mdream/js/splitter'

const chunks = htmlToMarkdownSplitChunks(html, withMinimalPreset({
  headersToSplitOn: [TAG_H2],
  chunkSize: 500,
  origin: 'https://example.com',
}))
```

## Content Negotiation

The `@mdream/js/negotiate` module provides HTTP content negotiation utilities for serving Markdown to LLM clients:

```ts
import { parseAcceptHeader, shouldServeMarkdown } from '@mdream/js/negotiate'

// Check if client prefers markdown
const serveMarkdown = shouldServeMarkdown(
  request.headers.get('accept'),
  request.headers.get('sec-fetch-dest'),
)

if (serveMarkdown) {
  return new Response(markdown, {
    headers: { 'Content-Type': 'text/markdown' },
  })
}
```

`shouldServeMarkdown()` uses Accept header quality weights and position ordering. It returns `true` when `text/markdown` or `text/plain` has higher priority than `text/html`. Browser navigation requests (`sec-fetch-dest: document`) always return `false`.

## Pure HTML Parser (JS Engine)

If you only need to parse HTML into a DOM-like event stream without converting to Markdown, use `parseHtml` from the JS engine:

```ts
import { parseHtml } from '@mdream/js/parse'

const html = '<div><h1>Title</h1><p>Content</p></div>'
const { events, remainingHtml } = parseHtml(html)

events.forEach((event) => {
  if (event.type === 0 && event.node.type === 1) { // Enter + Element
    console.log('Entering element:', event.node.name)
  }
})
```

The parser provides:
- Pure AST event stream with no markdown generation overhead
- Enter/exit events for each element and text node
- Plugin support during parsing
- Streaming compatible via `parseHtmlStream()`

## CLI Usage

Mdream provides a CLI that works with Unix pipes.

**Pipe site to Markdown:**

```bash
curl -s https://en.wikipedia.org/wiki/Markdown \
  | npx mdream --origin https://en.wikipedia.org --preset minimal \
  | tee output.md
```

**Local file to Markdown:**

```bash
cat index.html \
  | npx mdream --preset minimal \
  | tee output.md
```

### CLI Options

| Option | Description |
|--------|-------------|
| `--origin <url>` | Base URL for resolving relative links and images |
| `--preset minimal` | Enable the minimal preset |
| `-h`, `--help` | Display help information |

The CLI reads HTML from stdin and writes Markdown to stdout. It uses the streaming API internally.

## Browser and Edge Usage

### Edge / Cloudflare Workers

For edge runtimes (Cloudflare Workers, Vercel Edge), `mdream` automatically selects the WASM build via export conditions (`workerd`, `edge-light`). Both `htmlToMarkdown` and `streamHtmlToMarkdown` are available:

```ts
import { htmlToMarkdown, streamHtmlToMarkdown } from 'mdream'

// WASM engine auto-selected via export conditions
const markdown = htmlToMarkdown('<h1>Hello World</h1>')

// Streaming works the same as Node.js
const response = await fetch('https://example.com')
for await (const chunk of streamHtmlToMarkdown(response.body)) {
  // process chunk
}
```

You can also import the edge entry point directly:

```ts
import { htmlToMarkdown } from 'mdream/worker'
```

The `mdream/worker` entry provides an async API since WASM must be initialized first:

```ts
import { htmlToMarkdown, initWorker, terminateWorker } from 'mdream/worker'

// Initialize once with the WASM URL
await initWorker('https://cdn.example.com/mdream_edge_bg.wasm')

// Convert (returns Promise<string>)
const markdown = await htmlToMarkdown('<h1>Hello</h1>')

// Clean up when done
terminateWorker()
```

### Browser CDN (IIFE)

Use mdream directly via CDN with no build step. Call `init()` once to load the WASM binary, then use `htmlToMarkdown()` synchronously.

```html
<script src="https://unpkg.com/mdream/dist/iife.js"></script>
<script>
  await window.mdream.init()
  const markdown = window.mdream.htmlToMarkdown('<h1>Hello</h1><p>World</p>')
  console.log(markdown) // # Hello\n\nWorld
</script>
```

You can pass a custom WASM URL or `ArrayBuffer` to `init()`:

```js
// Custom URL
await window.mdream.init('https://cdn.example.com/mdream_edge_bg.wasm')

// Pre-loaded ArrayBuffer
const wasmBytes = await fetch('/wasm/mdream_edge_bg.wasm').then(r => r.arrayBuffer())
await window.mdream.init(wasmBytes)
```

**CDN Options:**
- **unpkg**: `https://unpkg.com/mdream/dist/iife.js`
- **jsDelivr**: `https://cdn.jsdelivr.net/npm/mdream/dist/iife.js`

### Web Worker

For browser environments, `mdream/worker` runs conversions off the main thread using a Web Worker:

```ts
import { htmlToMarkdown, initWorker, terminateWorker } from 'mdream/worker'

await initWorker('/path/to/mdream_edge_bg.wasm')

const markdown = await htmlToMarkdown('<h1>Hello</h1>')

// Clean up
terminateWorker()
```

## Content Extraction with Readability

For advanced content extraction (article detection, boilerplate removal), use [@mozilla/readability](https://github.com/mozilla/readability) before mdream:

```ts
import { Readability } from '@mozilla/readability'
import { JSDOM } from 'jsdom'
import { htmlToMarkdown } from 'mdream'

const dom = new JSDOM(html, { url: 'https://example.com' })
const article = new Readability(dom.window.document).parse()

if (article) {
  const markdown = htmlToMarkdown(article.content)
  // article.title, article.excerpt, article.byline also available
}
```

## llms.txt Generation

For llms.txt artifact generation, use the separate `@mdream/llms-txt` package. It accepts pre-converted Markdown and generates `llms.txt` and `llms-full.txt` artifacts.

```ts
import { generateLlmsTxtArtifacts } from '@mdream/llms-txt'
import { htmlToMarkdown } from 'mdream'

const result = await generateLlmsTxtArtifacts({
  files: [
    { title: 'Home', url: '/', content: htmlToMarkdown(homeHtml) },
    { title: 'About', url: '/about', content: htmlToMarkdown(aboutHtml) },
  ],
  siteName: 'My Site',
  origin: 'https://example.com',
  generateFull: true,
})

console.log(result.llmsTxt) // llms.txt content
console.log(result.llmsFullTxt) // llms-full.txt content
```

## Related Packages

| Package | Description |
|---------|-------------|
| [`mdream`](https://npmjs.com/package/mdream) | Core HTML to Markdown converter (Rust + WASM engine) |
| [`@mdream/js`](https://npmjs.com/package/@mdream/js) | JavaScript engine with hook-based plugins and splitter |
| [`@mdream/llms-txt`](https://github.com/harlan-zw/mdream/tree/main/packages/llms-txt) | Engine-agnostic llms.txt artifact generation |
| [`@mdream/crawl`](https://github.com/harlan-zw/mdream/tree/main/packages/crawl) | Site-wide crawler for llms.txt generation |
| [`@mdream/vite`](https://github.com/harlan-zw/mdream/tree/main/packages/vite) | Vite plugin integration |
| [`@mdream/nuxt`](https://github.com/harlan-zw/mdream/tree/main/packages/nuxt) | Nuxt module integration |
| [`@mdream/action`](https://github.com/harlan-zw/mdream/tree/main/packages/action) | GitHub Actions integration |

## License

Licensed under the [MIT license](https://github.com/harlan-zw/mdream/blob/main/LICENSE.md).
