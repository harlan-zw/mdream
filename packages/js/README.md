# @mdream/js

[![npm version][npm-version-src]][npm-version-href]
[![npm downloads][npm-downloads-src]][npm-downloads-href]
[![License][license-src]][license-href]

## Installation

```bash
# pnpm
pnpm add @mdream/js@beta

# npm
npm install @mdream/js@beta

# yarn
yarn add @mdream/js@beta
```

## Entry Points

| Import | Description |
|---|---|
| `@mdream/js` | Core `htmlToMarkdown` and `streamHtmlToMarkdown` APIs |
| `@mdream/js/plugins` | Plugin utilities: `createPlugin`, `extractionPlugin`, `extractionCollectorPlugin`, `filterPlugin`, `frontmatterPlugin`, `isolateMainPlugin`, `tailwindPlugin` |
| `@mdream/js/preset/minimal` | `withMinimalPreset` for declarative config combining frontmatter, isolateMain, tailwind, and filter plugins |
| `@mdream/js/negotiate` | HTTP content negotiation: `shouldServeMarkdown`, `parseAcceptHeader` |
| `@mdream/js/parse` | Low-level HTML parser: `parseHtml`, `parseHtmlStream` |
| `@mdream/js/splitter` | Single-pass markdown splitter: `htmlToMarkdownSplitChunks`, `htmlToMarkdownSplitChunksStream` |
| `@mdream/js/llms-txt` | llms.txt artifact generation: `generateLlmsTxtArtifacts`, `createLlmsTxtStream` |

## API Reference

### `htmlToMarkdown(html, options?)`

Converts an HTML string to Markdown synchronously.

```typescript
import { htmlToMarkdown } from '@mdream/js'

const md = htmlToMarkdown('<h1>Hello</h1><p>World</p>')
// # Hello\n\nWorld
```

**Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `html` | `string` | The HTML string to convert |
| `options` | `Partial<MdreamOptions>` | Optional configuration (see [MdreamOptions](#mdreamoptions)) |

**Returns:** `string`

### `streamHtmlToMarkdown(htmlStream, options?)`

Converts an HTML stream to Markdown incrementally. Useful for large documents or streaming HTTP responses.

```typescript
import { streamHtmlToMarkdown } from '@mdream/js'

const stream = streamHtmlToMarkdown(response.body, {
  origin: 'https://example.com',
})

for await (const chunk of stream) {
  process.stdout.write(chunk)
}
```

**Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `htmlStream` | `ReadableStream<Uint8Array \| string> \| null` | A web `ReadableStream` of HTML content |
| `options` | `Partial<MdreamOptions>` | Optional configuration (see [MdreamOptions](#mdreamoptions)) |

**Returns:** `AsyncIterable<string>`

---

## Options

### `MdreamOptions`

| Option | Type | Default | Description |
|---|---|---|---|
| `origin` | `string` | `undefined` | Origin URL for resolving relative image paths and internal links |
| `plugins` | `BuiltinPlugins` | `undefined` | Declarative built-in plugin configuration (see [BuiltinPlugins](#builtinplugins)) |
| `clean` | `boolean \| CleanOptions` | `undefined` | Post-processing cleanup. Pass `true` for all cleanup rules or an object for specific features (see [CleanOptions](#cleanoptions)). Sync API only for `fragments`. |
| `hooks` | `TransformPlugin[]` | `undefined` | Imperative hook-based transform plugins for custom behavior (see [Plugins](#plugins)) |

### `BuiltinPlugins`

Declarative configuration for built-in plugins. Works with both the JavaScript and Rust engines.

| Option | Type | Default | Description |
|---|---|---|---|
| `frontmatter` | `boolean \| ((fm: Record<string, string>) => void) \| FrontmatterConfig` | `undefined` | Extract metadata from HTML `<head>` into YAML frontmatter. Pass `true` for defaults, a callback to receive structured data, or a config object. |
| `isolateMain` | `boolean` | `undefined` | Isolate main content area. Prioritizes `<main>` elements, then falls back to header-to-footer heuristic. |
| `tailwind` | `boolean` | `undefined` | Convert Tailwind utility classes (bold, italic, hidden, etc.) to semantic Markdown formatting. |
| `filter` | `{ include?, exclude?, processChildren? }` | `undefined` | Filter elements by CSS selectors, tag names, or TAG_* constants (see [Filter Plugin](#filterpluginoptions)). |
| `extraction` | `Record<string, (element: ExtractedElement) => void>` | `undefined` | Extract elements matching CSS selectors during conversion. Each key is a CSS selector; the handler is called for every match. |
| `tagOverrides` | `Record<string, TagOverride \| string>` | `undefined` | Declarative tag overrides. String values act as aliases (e.g., `{ "x-heading": "h2" }`). Object values override specific handler properties. |

### `FrontmatterConfig`

| Option | Type | Default | Description |
|---|---|---|---|
| `additionalFields` | `Record<string, string>` | `undefined` | Extra key-value pairs to inject into the frontmatter |
| `metaFields` | `string[]` | `['description', 'keywords', 'author', 'date', 'og:title', 'og:description', 'twitter:title', 'twitter:description']` | Meta tag names to extract beyond the standard set |
| `onExtract` | `(frontmatter: Record<string, string>) => void` | `undefined` | Callback to receive structured frontmatter data after conversion |

### `TagOverride`

| Option | Type | Description |
|---|---|---|
| `enter` | `string` | Markdown string to emit when entering the tag |
| `exit` | `string` | Markdown string to emit when exiting the tag |
| `spacing` | `[number, number]` | Newlines to add `[before, after]` the tag |
| `isInline` | `boolean` | Whether the tag is inline (no block-level spacing) |
| `isSelfClosing` | `boolean` | Whether the tag is self-closing |
| `collapsesInnerWhiteSpace` | `boolean` | Whether inner whitespace should be collapsed |

### `CleanOptions`

Post-processing cleanup options. Pass `true` to `clean` to enable all of these.

| Option | Type | Default | Description |
|---|---|---|---|
| `urls` | `boolean` | `false` | Strip tracking query parameters (`utm_*`, `fbclid`, `gclid`, etc.) from URLs |
| `fragments` | `boolean` | `false` | Strip fragment-only links that do not match any heading slug in the output |
| `emptyLinks` | `boolean` | `false` | Strip links with meaningless hrefs (`#`, `javascript:void(0)`, `data:`, `vbscript:`) and replace with plain text |
| `blankLines` | `boolean` | `false` | Collapse 3+ consecutive blank lines to 2 |
| `redundantLinks` | `boolean` | `false` | Strip links where text equals URL: `[https://x.com](https://x.com)` becomes `https://x.com` |
| `selfLinkHeadings` | `boolean` | `false` | Strip self-referencing heading anchors: `## [Title](#title)` becomes `## Title` |
| `emptyImages` | `boolean` | `false` | Strip images with no alt text (decorative images, tracking pixels) |
| `emptyLinkText` | `boolean` | `false` | Drop links that produce no visible text: `[](url)` is removed entirely |

When `clean: true` is passed, all options except `urls` and `blankLines` are enabled.

---

## Plugins

### `createPlugin(plugin)`

Factory function for creating type-safe transform plugins. All hooks are optional.

```typescript
import { createPlugin } from '@mdream/js/plugins'

const myPlugin = createPlugin({
  beforeNodeProcess(event, state) {
    // Return { skip: true } to skip this node entirely
  },
  onNodeEnter(element, state) {
    // Return a string to inject markdown at this position
  },
  onNodeExit(element, state) {
    // Return a string to inject markdown at this position
  },
  processAttributes(element, state) {
    // Inspect or modify element attributes
  },
  processTextNode(textNode, state) {
    // Return { content: string, skip: boolean } to transform text
    // Return undefined for no transformation
  },
})
```

#### Plugin Hook Reference

| Hook | Parameters | Return Type | Description |
|---|---|---|---|
| `beforeNodeProcess` | `(event: NodeEvent, state)` | `{ skip: boolean } \| void` | Called before any node processing. Return `{ skip: true }` to skip the node. |
| `onNodeEnter` | `(element: ElementNode, state)` | `string \| void` | Called when entering an element. Return a string to inject markdown. |
| `onNodeExit` | `(element: ElementNode, state)` | `string \| void` | Called when exiting an element. Return a string to inject markdown. |
| `processAttributes` | `(element: ElementNode, state)` | `void` | Called to inspect or modify element attributes. |
| `processTextNode` | `(textNode: TextNode, state)` | `{ content: string, skip: boolean } \| void` | Called for each text node. Return an object to transform text or skip it. |

### `filterPlugin(options)`

Filters elements by CSS selectors, tag names, or TAG_* constants.

```typescript
import { TAG_FOOTER, TAG_NAV } from '@mdream/js'
import { filterPlugin } from '@mdream/js/plugins'

// Exclude navigation and footer
const plugin = filterPlugin({
  exclude: [TAG_NAV, TAG_FOOTER, '.sidebar', '#ads'],
})

// Include only specific elements
const plugin2 = filterPlugin({
  include: ['article', 'main'],
  processChildren: true, // default: true
})
```

| Option | Type | Default | Description |
|---|---|---|---|
| `include` | `(string \| number)[]` | `[]` | CSS selectors, tag names, or TAG_* constants for elements to include (all others excluded) |
| `exclude` | `(string \| number)[]` | `[]` | CSS selectors, tag names, or TAG_* constants for elements to exclude |
| `processChildren` | `boolean` | `true` | Whether to also process children of matching elements |

### `frontmatterPlugin(options?)`

Extracts metadata from HTML `<head>` into YAML frontmatter. Collects `<title>` and `<meta>` tags.

```typescript
import { frontmatterPlugin } from '@mdream/js/plugins'

const plugin = frontmatterPlugin({
  additionalFields: { source: 'crawler' },
  metaFields: ['robots', 'viewport'],
})
```

Default meta fields extracted: `description`, `keywords`, `author`, `date`, `og:title`, `og:description`, `twitter:title`, `twitter:description`.

### `isolateMainPlugin()`

Isolates the main content area of a page using a priority-based strategy:

1. If an explicit `<main>` element exists (within 5 depth levels), use its content exclusively.
2. Otherwise, find content between the first heading (`h1`-`h6`) that is not inside a `<header>` tag and the first `<footer>`.
3. The `<head>` section is always passed through for other plugins (e.g., frontmatter extraction).

```typescript
import { isolateMainPlugin } from '@mdream/js/plugins'

const plugin = isolateMainPlugin()
```

### `tailwindPlugin()`

Converts Tailwind utility classes to Markdown formatting. Supports mobile-first responsive breakpoints (`sm:`, `md:`, `lg:`, `xl:`, `2xl:`).

| Tailwind Class | Markdown Output |
|---|---|
| `font-bold`, `font-semibold`, `font-black`, `font-extrabold`, `font-medium` | `**text**` |
| `italic`, `font-italic` | `*text*` |
| `line-through` | `~~text~~` |
| `hidden`, `invisible` | Element skipped |
| `absolute`, `fixed`, `sticky` | Element skipped |

```typescript
import { tailwindPlugin } from '@mdream/js/plugins'

const plugin = tailwindPlugin()
```

### `extractionPlugin(selectors)` (Deprecated)

> Deprecated. Use `plugins.extraction` config for declarative extraction that works with both JS and Rust engines.

Extracts elements matching CSS selectors during conversion. Callbacks receive matching elements with their accumulated text content.

```typescript
import { extractionPlugin } from '@mdream/js/plugins'

const plugin = extractionPlugin({
  'h2': (element, state) => {
    console.log('Heading:', element.textContent)
  },
  'img[alt]': (element, state) => {
    console.log('Image:', element.attributes.src)
  },
})
```

### `extractionCollectorPlugin(selectors)`

Internal extraction collector for the `plugins.extraction` config. Collects results during processing and calls callbacks post-conversion to match Rust engine behavior.

---

## Presets

### `withMinimalPreset(options?)`

Returns a declarative config combining frontmatter, isolateMain, tailwind, and filter plugins. Also enables `clean: true` by default. You can override any option.

```typescript
import { htmlToMarkdown } from '@mdream/js'
import { withMinimalPreset } from '@mdream/js/preset/minimal'

const md = htmlToMarkdown(html, withMinimalPreset({
  origin: 'https://example.com',
}))
```

The minimal preset excludes these elements by default: `<form>`, `<fieldset>`, `<object>`, `<embed>`, `<footer>`, `<aside>`, `<iframe>`, `<input>`, `<textarea>`, `<select>`, `<button>`, `<nav>`.

You can override or extend the plugin config:

```typescript
const md = htmlToMarkdown(html, withMinimalPreset({
  origin: 'https://example.com',
  clean: { urls: true, fragments: true },
  plugins: {
    frontmatter: {
      additionalFields: { source: 'my-crawler' },
    },
  },
}))
```

---

## Content Negotiation

### `shouldServeMarkdown(acceptHeader?, secFetchDest?)`

Determines if a client prefers Markdown over HTML using HTTP content negotiation.

- Returns `true` when `text/markdown` or `text/plain` has higher quality than `text/html` in the Accept header.
- If qualities are equal, earlier position wins.
- Bare wildcards (`*/*`) do not trigger Markdown (prevents breaking OG crawlers).
- `sec-fetch-dest: document` always returns `false` (browser navigation).

```typescript
import { shouldServeMarkdown } from '@mdream/js/negotiate'

if (shouldServeMarkdown(request.headers.accept, request.headers['sec-fetch-dest'])) {
  return new Response(markdown, {
    headers: { 'content-type': 'text/markdown' },
  })
}
```

**Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `acceptHeader` | `string \| undefined` | The HTTP `Accept` header value |
| `secFetchDest` | `string \| undefined` | The `Sec-Fetch-Dest` header value |

**Returns:** `boolean`

### `parseAcceptHeader(accept)`

Parses an HTTP Accept header into an ordered list of media types with quality values.

```typescript
import { parseAcceptHeader } from '@mdream/js/negotiate'

const entries = parseAcceptHeader('text/markdown;q=0.9, text/html')
// [{ type: 'text/markdown', q: 0.9, position: 0 }, { type: 'text/html', q: 1, position: 1 }]
```

**Returns:** `Array<{ type: string, q: number, position: number }>`

---

## Markdown Splitter

### `htmlToMarkdownSplitChunks(html, options?)`

Converts HTML to Markdown and returns an array of chunks. Compatible with LangChain's `Document` structure.

```typescript
import { htmlToMarkdownSplitChunks } from '@mdream/js/splitter'

const chunks = htmlToMarkdownSplitChunks(html, {
  chunkSize: 1000,
  chunkOverlap: 200,
  origin: 'https://example.com',
})

for (const chunk of chunks) {
  console.log(chunk.content)
  console.log(chunk.metadata.headers) // e.g., { h2: 'Section Title' }
  console.log(chunk.metadata.code) // e.g., 'typescript'
  console.log(chunk.metadata.loc) // e.g., { lines: { from: 1, to: 10 } }
}
```

**Returns:** `MarkdownChunk[]`

### `htmlToMarkdownSplitChunksStream(html, options?)`

Generator version that yields chunks during processing for better memory efficiency.

```typescript
import { htmlToMarkdownSplitChunksStream } from '@mdream/js/splitter'

for (const chunk of htmlToMarkdownSplitChunksStream(html, options)) {
  process.stdout.write(chunk.content)
}
```

**Returns:** `Generator<MarkdownChunk, void, undefined>`

### `SplitterOptions`

Extends `EngineOptions` with chunking-specific settings.

| Option | Type | Default | Description |
|---|---|---|---|
| `headersToSplitOn` | `number[]` | `[TAG_H2, TAG_H3, TAG_H4, TAG_H5, TAG_H6]` | TAG_* header constants to split on |
| `returnEachLine` | `boolean` | `false` | Return each non-empty line as an individual chunk |
| `stripHeaders` | `boolean` | `true` | Strip header lines from chunk content |
| `chunkSize` | `number` | `1000` | Maximum chunk size (measured by `lengthFunction`) |
| `chunkOverlap` | `number` | `200` | Overlap between chunks for context preservation. Must be less than `chunkSize`. |
| `lengthFunction` | `(text: string) => number` | `(text) => text.length` | Function to measure chunk length. Replace with a token counter for LLM applications. |
| `keepSeparator` | `boolean` | `false` | Keep separators in the split chunks |

### `MarkdownChunk`

| Field | Type | Description |
|---|---|---|
| `content` | `string` | The markdown content of the chunk |
| `metadata.headers` | `Record<string, string> \| undefined` | Header hierarchy at this chunk position (e.g., `{ h2: 'API', h3: 'Methods' }`) |
| `metadata.code` | `string \| undefined` | Code block language if chunk contains code |
| `metadata.loc` | `{ lines: { from: number, to: number } } \| undefined` | Line number range in original document |

---

## llms.txt Generation

### `generateLlmsTxtArtifacts(options)`

Generates llms.txt content, optionally including llms-full.txt and individual markdown files.

```typescript
import { generateLlmsTxtArtifacts } from '@mdream/js/llms-txt'

const result = await generateLlmsTxtArtifacts({
  files: processedPages,
  siteName: 'My Site',
  description: 'A description of my site',
  origin: 'https://example.com',
  generateFull: true,
  generateMarkdown: true,
  sections: [
    {
      title: 'Documentation',
      description: 'API reference and guides',
      links: [
        { title: 'Getting Started', href: '/docs/start', description: 'Quick start guide' },
      ],
    },
  ],
  notes: 'Generated by mdream',
})

// result.llmsTxt         -- index file with links to pages
// result.llmsFullTxt     -- single file with all page content (if generateFull: true)
// result.markdownFiles   -- array of { path, content } (if generateMarkdown: true)
// result.processedFiles  -- the input files passed through
```

#### `LlmsTxtArtifactsOptions`

| Option | Type | Default | Description |
|---|---|---|---|
| `files` | `ProcessedFile[]` | (required) | Array of processed page files |
| `siteName` | `string` | `'Site'` | Site name for the header |
| `description` | `string` | `undefined` | Site description (rendered as blockquote) |
| `origin` | `string` | `''` | Origin URL to prepend to relative URLs |
| `generateFull` | `boolean` | `false` | Generate llms-full.txt with complete page content |
| `generateMarkdown` | `boolean` | `false` | Generate individual markdown files under `md/` directory |
| `outputDir` | `string` | `undefined` | Output directory (used to compute relative file paths) |
| `sections` | `LlmsTxtSection[]` | `undefined` | Custom sections to write before the Pages section |
| `notes` | `string \| string[]` | `undefined` | Notes to append at the end |

#### `ProcessedFile`

| Field | Type | Description |
|---|---|---|
| `title` | `string` | Page title |
| `content` | `string` | Markdown content of the page |
| `url` | `string` | URL path of the page |
| `filePath` | `string \| undefined` | Optional file path on disk |
| `metadata` | `{ title?, description?, keywords?, author? }` | Optional metadata extracted from the page |

#### `LlmsTxtSection`

| Field | Type | Description |
|---|---|---|
| `title` | `string` | Section heading |
| `description` | `string \| string[]` | Section description (can be multiple paragraphs) |
| `links` | `LlmsTxtLink[]` | Links in the section |

#### `LlmsTxtLink`

| Field | Type | Description |
|---|---|---|
| `title` | `string` | Link title |
| `href` | `string` | Link URL |
| `description` | `string \| undefined` | Optional description shown after the link |

### `createLlmsTxtStream(options)`

Creates a `WritableStream<ProcessedFile>` that generates llms.txt artifacts incrementally. Writes files to disk as pages are streamed in, never keeping full content in memory. Pages in llms.txt are sorted by URL path hierarchy on close.

```typescript
import { createLlmsTxtStream } from '@mdream/js/llms-txt'

const stream = createLlmsTxtStream({
  outputDir: './output',
  siteName: 'My Site',
  origin: 'https://example.com',
  generateFull: true,
})

const writer = stream.getWriter()
await writer.write({ title: 'Home', content: '# Home\nWelcome', url: '/' })
await writer.write({ title: 'About', content: '# About\nInfo', url: '/about' })
await writer.close()
// Writes llms.txt and llms-full.txt to ./output/
```

**Returns:** `WritableStream<ProcessedFile>`

---

## Low-Level Parser

### `parseHtml(html, options?)`

Parses HTML into a list of DOM events. Returns the events and any remaining unparsed HTML.

```typescript
import { parseHtml } from '@mdream/js/parse'

const { events, remainingHtml } = parseHtml('<p>Hello</p>')
```

**Returns:** `{ events: NodeEvent[], remainingHtml: string }`

### `parseHtmlStream(html, state, onEvent)`

Streaming parser that calls `onEvent` for each DOM event. Returns any remaining unparsed HTML (useful for processing partial chunks).

```typescript
import { parseHtmlStream } from '@mdream/js/parse'

const state = { depthMap: new Uint8Array(1024), depth: 0 }
const remaining = parseHtmlStream(htmlChunk, state, (event) => {
  // Process each event
})
```

**Returns:** `string` (remaining unparsed HTML)

---

## CLI

Reads HTML from stdin and outputs Markdown to stdout.

```bash
# Basic conversion
curl -s https://example.com | npx @mdream/js

# With origin URL for resolving relative paths
curl -s https://example.com | npx @mdream/js --origin https://example.com

# With minimal preset
curl -s https://example.com | npx @mdream/js --origin https://example.com --preset minimal
```

### CLI Options

| Flag | Description |
|---|---|
| `--origin <url>` | Origin URL for resolving relative image paths and links |
| `--preset <preset>` | Conversion preset. Currently supports: `minimal` |
| `-v, --version` | Show version number |
| `-h, --help` | Show help |

---

## Usage Examples

### Custom Tag Overrides

Map custom HTML elements to standard Markdown behavior:

```typescript
import { htmlToMarkdown } from '@mdream/js'

const md = htmlToMarkdown('<x-heading>Title</x-heading>', {
  plugins: {
    tagOverrides: {
      // String alias: make <x-heading> behave like <h2>
      'x-heading': 'h2',

      // Object override: custom enter/exit strings
      'callout': {
        enter: '> **Note:** ',
        exit: '\n',
        spacing: [2, 2],
      },
    },
  },
})
```

### Declarative Extraction

Extract data from elements during conversion:

```typescript
import { htmlToMarkdown } from '@mdream/js'

const images: { src: string, alt: string }[] = []

const md = htmlToMarkdown(html, {
  plugins: {
    extraction: {
      'img[alt]': (element) => {
        images.push({
          src: element.attributes.src,
          alt: element.attributes.alt,
        })
      },
    },
  },
})

console.log('Found images:', images)
```

### Frontmatter with Callback

Receive structured frontmatter data for further processing:

```typescript
import { htmlToMarkdown } from '@mdream/js'

let metadata: Record<string, string> = {}

const md = htmlToMarkdown(html, {
  plugins: {
    frontmatter: {
      additionalFields: { source: 'crawler' },
      metaFields: ['robots'],
      onExtract: (fm) => {
        metadata = fm
      },
    },
  },
})

console.log('Title:', metadata.title)
console.log('Description:', metadata.description)
```

### Custom Hooks for Content Filtering

```typescript
import { htmlToMarkdown } from '@mdream/js'
import { createPlugin } from '@mdream/js/plugins'

const md = htmlToMarkdown(html, {
  hooks: [
    createPlugin({
      beforeNodeProcess(event) {
        const { node } = event
        if (node.type === 1 /* ELEMENT_NODE */) {
          const el = node as any
          // Skip ads and promotional content
          if (el.attributes?.class?.includes('ad')
            || el.attributes?.id?.includes('promo')) {
            return { skip: true }
          }
        }
      },
      processTextNode(textNode) {
        // Uppercase all TODO markers
        if (textNode.value.includes('TODO')) {
          return { content: textNode.value.toUpperCase(), skip: false }
        }
      },
    }),
  ],
})
```

### Token-Based Chunking for LLMs

```typescript
import { htmlToMarkdownSplitChunks } from '@mdream/js/splitter'
import { encoding_for_model } from 'tiktoken'

const enc = encoding_for_model('gpt-4')

const chunks = htmlToMarkdownSplitChunks(html, {
  chunkSize: 512,
  chunkOverlap: 64,
  lengthFunction: text => enc.encode(text).length,
  origin: 'https://example.com',
})
```

---

## Exported Types

```typescript
import type {
  BuiltinPlugins,
  CleanOptions,
  ElementNode,
  EngineOptions,
  ExtractedElement,
  FrontmatterConfig,
  MarkdownChunk,
  MdreamOptions,
  Node,
  NodeEvent,
  PluginContext,
  SplitterOptions,
  TagOverride,
  TextNode,
  TransformPlugin,
} from '@mdream/js'
```

## Exported Constants

```typescript
import {
  ELEMENT_NODE, // Node type for HTML elements (1)
  NodeEventEnter, // Event type for entering a node (0)
  NodeEventExit, // Event type for exiting a node (1)
  TAG_H1, // Tag ID constant for <h1>
  TAG_H2, // Tag ID constant for <h2>
  TAG_H3, // Tag ID constant for <h3>
  TAG_H4, // Tag ID constant for <h4>
  TAG_H5, // Tag ID constant for <h5>
  TAG_H6, // Tag ID constant for <h6>
  TEXT_NODE, // Node type for text content (3)
} from '@mdream/js'
```


[npm-version-src]: https://img.shields.io/npm/v/@mdream/js/latest.svg?style=flat&colorA=18181B&colorB=4C9BE0
[npm-version-href]: https://npmjs.com/package/@mdream/js
[npm-downloads-src]: https://img.shields.io/npm/dm/@mdream/js.svg?style=flat&colorA=18181B&colorB=4C9BE0
[npm-downloads-href]: https://npm.chart.dev/@mdream/js
[license-src]: https://img.shields.io/npm/l/@mdream/js.svg?style=flat&colorA=18181B&colorB=4C9BE0
[license-href]: https://npmjs.com/package/@mdream/js
