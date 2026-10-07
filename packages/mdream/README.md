# mdream

[![npm version](https://img.shields.io/npm/v/mdream?color=yellow)](https://npmjs.com/package/mdream)
[![npm downloads](https://img.shields.io/npm/dm/mdream?color=yellow)](https://npm.chart.dev/mdream)
[![license](https://img.shields.io/github/license/harlan-zw/mdream?color=yellow)](https://github.com/harlan-zw/mdream/blob/main/LICENSE.md)
<a href="https://skilld.dev/gh/harlan-zw/mdream">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://skilld.dev/b/harlan-zw/mdream?theme=dark">
    <source media="(prefers-color-scheme: light)" srcset="https://skilld.dev/b/harlan-zw/mdream?theme=light">
    <img alt="Skill repository on skilld.dev" src="https://skilld.dev/b/harlan-zw/mdream?theme=light">
  </picture>
</a>

Powering Cloudflare Browser Run's [/markdown](https://developers.cloudflare.com/browser-run/quick-actions/markdown-endpoint/) and [/crawl](https://developers.cloudflare.com/browser-run/quick-actions/crawl-endpoint/) endpoints.

> [!TIP]
> 🎉 **Upgrading to Mdream v2?** Follow [Migrating from v1](#migrating-from-v1).

## Installation

```bash
# npm
npm install mdream

# pnpm
pnpm add mdream

# yarn
yarn add mdream
```

> [!TIP]
> Using an AI agent? Get the mdream Skill on [skilld.dev/gh/harlan-zw/mdream](https://skilld.dev/gh/harlan-zw/mdream).

For the JavaScript-only engine with explicit plugins, formats, splitter, and parser:

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

- [Migrating from v1](#migrating-from-v1)
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
- [Plugins (JS Engine)](#plugins-js-engine)
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
- [llms.txt Generation](#llmstxt-generation)
- [Related Packages](#related-packages)

## Migrating from v1

Using a coding agent? Give it the [v1 to v2 migration prompt](https://github.com/harlan-zw/mdream/blob/main/MIGRATION_PROMPT.md).

Install `mdream` for the Rust engine.
This guide covers v2.
For an earlier release, read the README at its release tag.
Node and edge conversions still return a string synchronously.
The `format`, `clean`, and top-level plugin options remain available.
Custom hook plugins use `@mdream/js`; follow its [migration guide](../js/README.md#migrating-from-v1).
That guide also covers upgrades from an earlier v2 beta.

### Unknown options

Every entry throws a `TypeError` for an option that it does not read.
In v1, mdream ignored an unknown option, so a typo gave no error.
The error names the fix.
An option set to `undefined` does not throw.

| Old option | v2 option |
|------------|-----------|
| `preset: 'minimal'` | `minimal: true` |
| `cleanUrls: true` | `clean: { urls: true }` |
| `plugins: { frontmatter: true }` | `frontmatter: true`, at the top level |
| `plugins: [myPlugin]` | `@mdream/js` with `plugins: [myPlugin]` |

`clean.blankLines` is removed. It had no effect in either engine, so delete it.

The `mdream` CLI exits with code 1 on an unknown flag, a flag without a value, or an unknown `--preset` value.
In v1, the CLI ignored them.

### Browser imports and returns

In a browser bundle, import from `mdream/browser`.
Its `htmlToMarkdown` returns `Promise<string>`.
Remove `.markdown` and await the conversion:

```diff
- import { htmlToMarkdown } from 'mdream'
- const markdown = (await htmlToMarkdown(html)).markdown
+ import { htmlToMarkdown } from 'mdream/browser'
+ const markdown = await htmlToMarkdown(html)
```

In a browser bundle, the root `mdream` entry throws a `TypeError` when you call it.
The import itself does not throw.
A module that runs on the server and the client can import `mdream` and call it only on the server.
The `mdream/browser` types need no TypeScript `customConditions` setting.

For a CDN script:

```diff
- const markdown = window.mdream.htmlToMarkdown(html).markdown
+ const markdown = await window.mdream.htmlToMarkdown(html)
```

Use the CDN example inside an async function or a `<script type="module">` block.
See [Browser and Edge Usage](#browser-and-edge-usage) for edge runtimes and the CDN script.

### Web Worker

v2 removes `mdream/worker`.
To convert off the main thread, write a module worker that imports `mdream/browser`:

```ts
// md.worker.ts
import { htmlToMarkdown } from 'mdream/browser'

addEventListener('message', async (event: MessageEvent<string>) => {
  postMessage(await htmlToMarkdown(event.data, { minimal: true }))
})
```

```ts
// main.ts
const worker = new Worker(new URL('./md.worker.ts', import.meta.url), { type: 'module' })
worker.onmessage = (event: MessageEvent<string>) => console.log(event.data)
worker.postMessage('<h1>Hello</h1>')
```

Your bundler builds the worker and copies the WASM binary.
Functions cannot cross `postMessage`.
To use callbacks such as `frontmatter`, set them inside the worker.

### Minimal filtering

With `minimal: true`, a custom `filter` adds to the preset's excludes.
In v1, it replaced them and could restore forms and navigation.
To keep those elements in v2, disable the preset filter.
To apply only your own excludes, use `minimal: false` and compose the options:

```ts
import { htmlToMarkdown } from 'mdream'

htmlToMarkdown(html, { minimal: true, filter: false })

htmlToMarkdown(html, {
  frontmatter: true,
  isolateMain: true,
  tailwind: true,
  clean: true,
  filter: { exclude: ['footer'] },
})
```

### Page titles

`<title>` text no longer appears in the body, in any output format.
To include it in Markdown metadata, enable `frontmatter: true`.
To read it separately, use `extraction: { title: element => console.log(element.textContent) }`.
Review saved output or snapshots that relied on a leading title line.
The converter also removes trailing spaces from link text before empty elements. See [#318](https://github.com/harlan-zw/mdream/pull/318).
Stream boundaries can change. Join the output before comparing snapshots.

### Markdown splitting

The JS splitter changes its chunk text, line ranges, overlap, and first-chunk timing.
If you store chunks or embeddings, rebuild them from the original HTML.
See [Splitter output and timing](../js/README.md#splitter-output-and-timing) for the upgrade steps.

### Direct native binding access

The package's `exports` map defines its public API. It does not expose `napi/`.
If you loaded the native binding by file path, replace these removed exports:

| Removed native API | Public API |
|---|---|
| `splitMarkdown`, `htmlToMarkdownChunks` | `htmlToMarkdownSplitChunks` from `@mdream/js/splitter`, with the original HTML input |
| `htmlToMarkdownBytes` | Decode complete HTML bytes with `TextDecoder`, then call `htmlToMarkdown` from `mdream` |
| `MarkdownStream.processChunkBytes` | `streamHtmlToMarkdown` from `mdream`, which still accepts byte streams |

For direct Markdown splitting in Rust, use `mdream::splitter::split_markdown`.

## API Reference

### `htmlToMarkdown()`

Converts a complete HTML string to Markdown, plain text, or HTML. It is synchronous in Node and on edge runtimes.

**Rust engine** (`mdream`):

```ts
import type { MdreamOptions } from 'mdream'

declare function htmlToMarkdown(html: string, options?: Partial<MdreamOptions>): string

// `mdream/browser` and the CDN script return Promise<string> instead.
```

**JS engine** (`@mdream/js`) uses a separate entry point for each format:

```ts
import { htmlToMarkdown } from '@mdream/js'
import { htmlToSafeHtml } from '@mdream/js/html'
import { htmlToText } from '@mdream/js/text'
```

```ts
import type { MdreamOptions } from '@mdream/js'

declare function htmlToMarkdown(html: string, options?: Partial<MdreamOptions>): string
declare function htmlToText(html: string, options?: Partial<MdreamOptions>): string
declare function htmlToSafeHtml(html: string, options?: Partial<MdreamOptions>): string
```

**Example:**

```ts
import { htmlToMarkdown } from 'mdream'

const markdown = htmlToMarkdown('<h1>Hello World</h1><p>Some content.</p>')
// # Hello World
//
// Some content.

const text = htmlToMarkdown('<h1>Hello <strong>World</strong></h1>', {
  format: 'text',
})
// Hello World

const html = htmlToMarkdown('<h1>Hello <strong>World</strong></h1>', {
  format: 'html',
})
// <h1 id="hello-world">Hello <strong>World</strong></h1>
```

### `streamHtmlToMarkdown()`

Converts an HTML `ReadableStream` to Markdown, plain text, or HTML incrementally. Returns an `AsyncIterable<string>` that yields output chunks as they are processed.

It takes the same options as `htmlToMarkdown()`. The `frontmatter` callback and the `extraction` handlers run once, after the stream ends and before the last chunk is yielded.


```ts
import type { MdreamOptions } from 'mdream'

declare function streamHtmlToMarkdown(
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

Choose the Rust or JavaScript engine.
The `mdream` package selects its Rust binding by runtime.
Import `@mdream/js` to use the JavaScript engine:

| Engine | Package | Plugins | Use case |
|--------|---------|---------|----------|
| **Rust** (NAPI) | `mdream` | Declarative config only | Node.js (default) |
| **Rust** (WASM) | `mdream`, `mdream/browser` | Declarative config only | Edge, browser |
| **JavaScript** | `@mdream/js` | Explicit plugin arrays | Small bundles, custom plugins, splitter |

```ts
// JavaScript engine for explicit plugins and smaller bundles
import { htmlToMarkdown } from '@mdream/js'

// Rust NAPI engine (auto-selected in Node.js)
import { htmlToMarkdown as htmlToMarkdownRust } from 'mdream'
```

The Rust engine takes declarative options: `minimal`, `format`, `frontmatter`, `isolateMain`, `tailwind`, `filter`, and `extraction`.
Pass them at the top level.

The JS engine takes an array of plugin instances in `options.plugins`.
Each output format has its own entry point.
For its minimal preset, use `withMinimalPreset()` from `@mdream/js/preset/minimal`.
If you pass Rust-only options to the JS engine, it throws a `TypeError` that names the fix.

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
  filter?: false | { include?: string[], exclude?: string[], processChildren?: boolean }

  /** Extract elements matching CSS selectors during conversion. */
  extraction?: Record<string, (element: ExtractedElement) => void>

  /** Override tag rendering behavior. String values act as aliases. */
  tagOverrides?: Record<string, TagOverride | string>

  /**
   * Hard-wrap prose at this many characters, breaking on word boundaries.
   * Applied inline during conversion (zero-cost when unset). Code blocks,
   * tables, and headings are never wrapped. `0` (or unset) disables wrapping.
   */
  wrapWidth?: number

  /** Output Markdown, plain text, or HTML. Default: 'markdown' */
  format?: 'markdown' | 'text' | 'html'
}
```

Any other key throws a `TypeError` that names the key and the fix.

### MdreamOptions (JS engine)

The JS engine uses explicit plugins. Each output format has its own entry point.

```ts
interface MdreamOptions extends EngineOptions {
  /** Explicit plugins, applied in array order. */
  plugins?: Plugin[]
}

interface EngineOptions {
  origin?: string
  /** Cleanup rules from clean() in @mdream/js/clean */
  clean?: Cleaner
  tagOverrides?: Record<string, TagOverride | string>

  /**
   * Hard-wrap prose at this many characters, breaking on word boundaries.
   * Code blocks, tables, and headings are never wrapped. `0` (or unset)
   * disables wrapping.
   */
  wrapWidth?: number

}
```

Use `@mdream/js/text` for plain text. Use `@mdream/js/html` for safe HTML.
Any other key throws a `TypeError` that names the key and the fix.

### CleanOptions

Post-processing cleanup applied to the final Markdown output. All options default to `false` unless `clean: true` is set.

With `@mdream/js`, pass these rules to `clean()` from `@mdream/js/clean`, for example `clean: clean({ urls: true })`.

```ts
interface CleanOptions {
  /** Strip tracking query parameters (utm_*, fbclid, gclid, etc.) from URLs */
  urls?: boolean
  /** Strip fragment-only links that don't match any heading in the output */
  fragments?: boolean
  /** Strip links with meaningless hrefs (#, javascript:void(0)) to plain text */
  emptyLinks?: boolean
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
import { htmlToMarkdown } from 'mdream'

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

> **Unknown tags pass through as plain text.** Tag matching is strict: only the standard HTML tags ship with built-in Markdown semantics. Custom elements (`<my-widget>`), web components, and any non-standard tag emit their text content verbatim, with the surrounding tag dropped. To render a custom tag with Markdown semantics, alias it with `tagOverrides`:
>
> ```ts
> htmlToMarkdown('<my-em>hi</my-em>', { tagOverrides: { 'my-em': 'em' } })
> // → "*hi*"
> ```

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
import { htmlToMarkdown } from 'mdream'

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

**Output is GitHub Flavored Markdown.** Mdream emits a fixed GFM dialect tuned for LLM input: ATX headings (`#`), fenced code blocks (` ``` `), `-` bullets, `*` emphasis, `**` strong, `---` horizontal rules, inline links. These are not configurable. For simple delimiter swaps you can use `tagOverrides`:

```ts
import { htmlToMarkdown } from 'mdream'

htmlToMarkdown(html, {
  tagOverrides: {
    em: { enter: '_', exit: '_', isInline: true }, // *x*  →  _x_
    strong: { enter: '__', exit: '__', isInline: true }, // **x** →  __x__
    hr: { enter: '* * *', exit: '' }, // ---  →  * * *
  },
})
```

Structural style differences (setext headings, indented code blocks, reference-style links, `~~~` fences, dynamic list markers) are out of scope. If you need turndown-style configurability, use [turndown](https://github.com/mixmark-io/turndown). If you have a use case for these in mdream, please open an issue.

### FilterOptions

```ts
interface FilterOptions {
  /** CSS selectors or tag names for elements to include (all others excluded) */
  include?: string[]
  /** CSS selectors or tag names for elements to exclude */
  exclude?: string[]
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

A `filter` passed with `minimal` adds to the preset's excludes. It does not replace them. To turn the preset's filter off, pass `filter: false`. In the JS engine, a `filterPlugin()` appended to `withMinimalPreset()` also adds to the excludes.

```ts
import { htmlToMarkdown } from 'mdream'

// Excludes h1 as well as form, nav, footer, and the rest
htmlToMarkdown(html, { minimal: true, filter: { exclude: ['h1'] } })

// Keeps forms and nav
htmlToMarkdown(html, { minimal: true, filter: false })
```

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

`withMinimalPreset()` returns explicit plugin defaults. You can append custom plugins. An appended `filterPlugin()` adds to the preset's excludes:

```ts
import { htmlToMarkdown } from '@mdream/js'
import { filterPlugin } from '@mdream/js/plugins'
import { withMinimalPreset } from '@mdream/js/preset/minimal'

const markdown = htmlToMarkdown(html, withMinimalPreset({
  plugins: [filterPlugin({ exclude: ['.cookie-banner'] }), myPlugin],
}))
```

## Built-in Plugins

The Rust engine uses declarative options. The JS engine exports matching plugin factories.

### Frontmatter Plugin

Extracts metadata from the HTML `<head>` element and generates YAML frontmatter.

**Extracted fields by default:** `title`, `description`, `keywords`, `author`, `date`, `og:title`, `og:description`, `twitter:title`, `twitter:description`.

```ts
import { htmlToMarkdown } from 'mdream'

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
import { htmlToMarkdown } from 'mdream'

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
import { htmlToMarkdown } from 'mdream'

htmlToMarkdown(html, { tailwind: true })
```

### Filter Plugin

Filters HTML elements by CSS selectors or tag names.

```ts
import { htmlToMarkdown } from 'mdream'

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

The JS engine takes the same strings in `filterPlugin`. If an entry is not a string, `filterPlugin` throws a `TypeError`.

```ts
import { htmlToMarkdown } from '@mdream/js'
import { filterPlugin } from '@mdream/js/plugins'

htmlToMarkdown(html, {
  plugins: [filterPlugin({ exclude: ['nav', 'footer'] })],
})
```

Elements with `style="position: absolute"` or `style="position: fixed"` are also automatically excluded when the filter plugin is active.

### Extraction Plugin

Extracts elements matching CSS selectors during conversion. Callbacks receive the matched element with its accumulated text content and attributes.

```ts
import { htmlToMarkdown } from 'mdream'

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

## Plugins (JS Engine)

The JS engine composes plugins in an explicit array.

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

const markdown = htmlToMarkdown(html, { plugins: [myPlugin] })
```

### Plugin Hooks

Each hook gets a read-only `PluginState`. To keep data for a node, set it on `node.context`.

```ts
interface PluginState {
  /** Options passed to the converter. */
  readonly options: Readonly<EngineOptions>
  /** Output that the running converter writes. */
  readonly outputFormat: 'markdown' | 'text' | 'html'
  /** Nesting depth of the current node. It is 0 before the first node. */
  readonly depth: number
}

interface TransformPlugin {
  /**
   * Called before any node processing. Return { skip: true } to skip the node.
   */
  beforeNodeProcess?: (
    event: NodeEvent,
    state: PluginState,
  ) => undefined | void | { skip: boolean }

  /**
   * Called when entering an element node.
   * Return a string to prepend to the output.
   */
  onNodeEnter?: (
    node: ElementNode,
    state: PluginState,
  ) => string | undefined | void

  /**
   * Called when exiting an element node.
   * Return a string to append to the output.
   */
  onNodeExit?: (
    node: ElementNode,
    state: PluginState,
  ) => string | undefined | void

  /**
   * Called to process element attributes (e.g., extracting Tailwind classes).
   */
  processAttributes?: (
    node: ElementNode,
    state: PluginState,
  ) => void

  /**
   * Called for each text node. Return { content, skip } to transform text.
   * Return undefined for no transformation.
   */
  processTextNode?: (
    node: TextNode,
    state: PluginState,
  ) => { content: string, skip: boolean } | undefined

  /**
   * Called once after the whole document is converted, including for streams.
   */
  onDocumentEnd?: (state: PluginState) => void
}
```

### `createPlugin()`

A typed identity function for creating plugins with full TypeScript inference:

```ts
import type { ElementNode } from '@mdream/js'
import { ELEMENT_NODE } from '@mdream/js'
import { createPlugin } from '@mdream/js/plugins'

const plugin = createPlugin({
  beforeNodeProcess({ node }) {
    // Skip all div elements with class "ad"
    if (node.type === ELEMENT_NODE) {
      const element = node as ElementNode
      if (element.name === 'div' && element.attributes.class?.split(/\s+/).includes('ad')) {
        return { skip: true }
      }
    }
  },
})
```

### Built-in Plugin Functions (JS Engine)

The following plugin factory functions are available from `@mdream/js/plugins`:

```ts
import {
  createPlugin,
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
import { htmlToMarkdownSplitChunks } from '@mdream/js/splitter'

const html = `
  <h1>Documentation</h1>
  <h2>Installation</h2>
  <p>Install via npm...</p>
  <h2>Usage</h2>
  <p>Use it like this...</p>
`

const chunks = htmlToMarkdownSplitChunks(html, {
  headersToSplitOn: [2],
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

The generator converts the whole document before yielding its first chunk.
It keeps the converted Markdown in memory, but avoids collecting the chunk array.
Stopping early skips the remaining chunk work. HTML conversion has already finished.
See [Splitter output and timing](../js/README.md#splitter-output-and-timing) for migration details.

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
   * Heading levels that start a new chunk, from 1 (<h1>) to 6 (<h6>).
   * Another value throws a TypeError. Default: [2, 3, 4, 5, 6]
   */
  headersToSplitOn?: (1 | 2 | 3 | 4 | 5 | 6)[]

  // --- Size-based splitting ---

  /** Target chunk size in characters. Complete code fences can exceed it. Default: 1000 */
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

  /** The splitter drops whitespace between chunks for either value. */
  keepSeparator?: boolean

  // --- Standard options ---

  /** Base URL for resolving relative links/images */
  origin?: string

  /** Explicit plugins, applied in array order */
  plugins?: Plugin[]

  /** Custom tag output or aliases */
  tagOverrides?: Record<string, TagOverride | string>

  /** Cleanup rules from clean() in @mdream/js/clean */
  clean?: Cleaner
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
    /** Inclusive, one-based line range in converted Markdown, excluding stripped headings */
    loc?: {
      lines: { from: number, to: number }
    }
  }
}
```

### Use with Presets

Combine splitting with presets:

```ts
import { withMinimalPreset } from '@mdream/js/preset/minimal'
import { htmlToMarkdownSplitChunks } from '@mdream/js/splitter'

const chunks = htmlToMarkdownSplitChunks(html, withMinimalPreset({
  headersToSplitOn: [2],
  chunkSize: 500,
  origin: 'https://example.com',
}))
```

## Content Negotiation

The `@mdream/js/negotiate` module provides HTTP content negotiation utilities for serving Markdown to LLM clients:

```ts
import { shouldServeMarkdown } from '@mdream/js/negotiate'

export function markdownResponse(request: Request, markdown: string): Response | undefined {
  if (shouldServeMarkdown(
    request.headers.get('accept') ?? undefined,
    request.headers.get('sec-fetch-dest') ?? undefined,
  )) {
    return new Response(markdown, {
      headers: { 'Content-Type': 'text/markdown' },
    })
  }
}
```

`shouldServeMarkdown()` uses Accept header quality weights and position ordering. It returns `true` when `text/markdown` or `text/plain` has higher priority than `text/html`. Browser navigation requests (`sec-fetch-dest: document`) always return `false`.

## Pure HTML Parser (JS Engine)

If you only need to parse HTML into a DOM-like event stream without converting to Markdown, use `parseHtml` from the JS engine:

```ts
import type { ElementNode } from '@mdream/js'
import { ELEMENT_NODE, NodeEventEnter } from '@mdream/js'
import { parseHtml } from '@mdream/js/parse'

const html = '<div><h1>Title</h1><p>Content</p></div>'
const { events, remainingHtml } = parseHtml(html)

events.forEach((event) => {
  if (event.type === NodeEventEnter && event.node.type === ELEMENT_NODE) {
    console.log('Entering element:', (event.node as ElementNode).name)
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

**Plain text output:**

```bash
cat index.html \
  | npx mdream --format text \
  | tee output.txt
```

**HTML output:**

```bash
cat index.html \
  | npx mdream --format html \
  | tee output.html
```

### CLI Options

| Option | Description |
|--------|-------------|
| `--origin <url>` | Base URL for resolving relative links and images |
| `--preset minimal` | Enable the minimal preset |
| `--wrap-width <n>` | Hard-wrap prose at `n` characters (code, tables, and headings are never wrapped) |
| `--format <format>` | Output format: `markdown`, `text`, `html` |
| `--text` | Alias for `--format text` |
| `-h`, `--help` | Display help information |

The CLI reads HTML from stdin and writes Markdown, plain text, or HTML to stdout. It uses the streaming API internally.
A value option also accepts the `--origin=<url>` form.
If you pass an unknown flag, a flag without a value, or an unknown preset, the CLI writes one line to stderr and exits with code 1.

## Browser and Edge Usage

Every entry takes the same `MdreamOptions` and produces the same Markdown string.
In Node and edge runtimes, `htmlToMarkdown` from `mdream` is synchronous.
In a browser bundle, import from `mdream/browser`.
Its `htmlToMarkdown` returns `Promise<string>`, because the WASM binary loads first.
The CDN script also returns `Promise<string>`.

```ts
import { htmlToMarkdown } from 'mdream/browser'

const markdown = await htmlToMarkdown('<h1>Hello</h1>', { minimal: true })
```

In a browser bundle, the root `mdream` entry throws a `TypeError` when you call it.
The `mdream` types always describe the synchronous API.
To convert off the main thread, see [Web Worker](#web-worker).

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

You can catch conversion errors.
An internal Rust panic aborts the call because WASM has no unwinding.
The wrapper preserves the panic message in an `Error`, with the raw WASM trap as `cause`.
The instance remains usable for later requests:

```ts
import { htmlToMarkdown } from 'mdream'

export function convertResponse(html: string): Response {
  try {
    return new Response(htmlToMarkdown(html))
  }
  catch (error) {
    console.error(error)
    return new Response('Conversion failed', { status: 500 })
  }
}
```

If your toolchain does not resolve export conditions, import the web-target wasm-bindgen build from `mdream/wasm`.
Initialize it manually before converting.
Its `htmlToMarkdown` takes the same `MdreamOptions` as `mdream`.
Its `MarkdownStream` runs callbacks in `finish()`.

Your bundler must support `.wasm` imports and provide their TypeScript declarations.

```ts
import init, { htmlToMarkdown } from 'mdream/wasm'
import wasmModule from 'mdream/wasm/mdream_edge_bg.wasm'

await init({ module_or_path: wasmModule })
const markdown = htmlToMarkdown('<h1>Hello</h1>', { minimal: true })
```

### Browser CDN (IIFE)

Use mdream from a CDN without a build step.
The script includes the WASM binary and initializes it on load.
Call `window.mdream.htmlToMarkdown()` with the same `MdreamOptions` as `mdream`.
Await its `Promise<string>`, as with `mdream/browser`.

```html
<script src="https://unpkg.com/mdream/dist/iife.js"></script>
<script>
  window.mdream.htmlToMarkdown('<h1>Hello</h1><p>World</p>')
    .then(markdown => console.log(markdown)) // # Hello\n\nWorld
</script>
```

**CDN Options:**
- **unpkg**: `https://unpkg.com/mdream/dist/iife.js`
- **jsDelivr**: `https://cdn.jsdelivr.net/npm/mdream/dist/iife.js`

## Content Extraction with Readability

For advanced content extraction (article detection, boilerplate removal), use [@mozilla/readability](https://github.com/mozilla/readability) before mdream:

```ts
import { Readability } from '@mozilla/readability'
import { JSDOM } from 'jsdom'
import { htmlToMarkdown } from 'mdream'

const dom = new JSDOM(html, { url: 'https://example.com' })
const article = new Readability(dom.window.document).parse()

if (article?.content) {
  const markdown = htmlToMarkdown(article.content)
  // article.title, article.excerpt, article.byline also available
}
```

## llms.txt Generation

For llms.txt artifact generation, use `@mdream/js/llms-txt` from the `@mdream/js` package. It accepts pre-converted Markdown and generates `llms.txt` and `llms-full.txt` artifacts.

```ts
import { generateLlmsTxtArtifacts } from '@mdream/js/llms-txt'
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
| [`@mdream/js`](https://npmjs.com/package/@mdream/js) | JavaScript engine with tree-shakable formats, plugins, splitter, and llms.txt generation (`@mdream/js/llms-txt`) |
| [`@mdream/crawl`](https://github.com/harlan-zw/mdream/tree/main/packages/crawl) | Site-wide crawler for llms.txt generation |
| [`@mdream/vite`](https://github.com/harlan-zw/mdream/tree/main/packages/vite) | Vite plugin integration |
| [`@mdream/nuxt`](https://github.com/harlan-zw/mdream/tree/main/packages/nuxt) | Nuxt module integration |
| [`@mdream/action`](https://github.com/harlan-zw/mdream/tree/main/packages/action) | GitHub Actions integration |

## License

Licensed under the [MIT license](https://github.com/harlan-zw/mdream/blob/main/LICENSE.md).
