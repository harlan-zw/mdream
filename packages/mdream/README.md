# mdream

[![npm version](https://img.shields.io/npm/v/mdream?color=yellow)](https://npmjs.com/package/mdream)
[![npm downloads](https://img.shields.io/npm/dm/mdream?color=yellow)](https://npm.chart.dev/mdream)
[![license](https://img.shields.io/github/license/harlan-zw/mdream?color=yellow)](https://github.com/harlan-zw/mdream/blob/main/LICENSE.md)

> Ultra-performant HTML to Markdown Convertor Optimized for LLMs. Generate llms.txt artifacts using CLI, GitHub Actions, Vite Plugin and more.

<img src="../../.github/logo.png" alt="mdream logo" width="200">

<p align="center">
<table>
<tbody>
<td align="center">
<sub>Made possible by my <a href="https://github.com/sponsors/harlan-zw">Sponsor Program 💖</a><br> Follow me <a href="https://twitter.com/harlan_zw">@harlan_zw</a> 🐦 • Join <a href="https://discord.gg/275MBUBvgP">Discord</a> for help</sub><br>
</td>
</tbody>
</table>
</p>

## Features

- 🧠 Optimized HTML To Markdown Conversion (~50% fewer tokens with [Minimal preset](./src/preset/minimal.ts))
- 🔍 Generates GitHub Flavored Markdown: Frontmatter, Nested & HTML markup support.
- 🚀 Fast: Stream 1.4MB of HTML to markdown in ~50ms.
- ⚡ Tiny: 5kB gzip, zero dependency core.
- ⚙️ Run anywhere: CLI, edge workers, browsers, Node, etc.
- 🔌 Extensible: [Plugin system](#plugin-system) for customizing and extending functionality.

## What is Mdream?

Traditional HTML to Markdown converters were not built for LLMs or humans. They tend to be slow and bloated and produce output that's poorly suited for LLMs token usage or for
human readability.

Other LLM specific convertors focus on supporting _all_ document formats, resulting in larger bundles and lower quality Markdown output.

Mdream produces high-quality Markdown for LLMs efficiently with no core dependencies. It includes a plugin system to customize the conversion process, allowing you to parse, extract, transform, and filter as needed.

## Installation

```bash
pnpm add mdream
```

## CLI Usage

Mdream provides a CLI designed to work exclusively with Unix pipes,
providing flexibility and freedom to integrate with other tools.

**Pipe Site to Markdown**

Fetches the [Markdown Wikipedia page](https://en.wikipedia.org/wiki/Markdown) and converts it to Markdown preserving the original links and images.

```bash
curl -s https://en.wikipedia.org/wiki/Markdown \
 | npx mdream --origin https://en.wikipedia.org --preset minimal \
  | tee streaming.md
```

_Tip: The `--origin` flag will fix relative image and link paths_

**Local File to Markdown**

Converts a local HTML file to a Markdown file, using `tee` to write the output to a file and display it in the terminal.

```bash
cat index.html \
 | npx mdream --preset minimal \
  | tee streaming.md
```

### CLI Options

- `--origin <url>`: Base URL for resolving relative links and images
- `--preset <preset>`: Conversion presets: minimal
- `--help`: Display help information
- `--version`: Display version information

## API Usage

Mdream provides two main functions for working with HTML:
- `htmlToMarkdown`: Useful if you already have the entire HTML payload you want to convert.
- `streamHtmlToMarkdown`: Best practice if you are fetching or reading from a local file.

## Browser CDN Usage

For browser environments, you can use mdream directly via CDN without any build step:

```html
<!DOCTYPE html>
<html>
<head>
  <script src="https://unpkg.com/mdream/dist/iife.js"></script>
</head>
<body>
  <script>
    // Convert HTML to Markdown in the browser
    const html = '<h1>Hello World</h1><p>This is a paragraph.</p>'
    const markdown = window.mdream.htmlToMarkdown(html)
    console.log(markdown) // # Hello World\n\nThis is a paragraph.
  </script>
</body>
</html>
```

**CDN Options:**
- **unpkg**: `https://unpkg.com/mdream/dist/iife.js`
- **jsDelivr**: `https://cdn.jsdelivr.net/npm/mdream/dist/iife.js`

The browser build includes the core `htmlToMarkdown` function and is optimized for size (44kB uncompressed, 10.3kB gzipped).

**Convert existing HTML**

```ts
import { htmlToMarkdown } from 'mdream'

// Simple conversion
const markdown = htmlToMarkdown('<h1>Hello World</h1>')
console.log(markdown) // # Hello World
```

**Convert from Fetch**

```ts
import { streamHtmlToMarkdown } from 'mdream'

// Using fetch with streaming
const response = await fetch('https://example.com')
const htmlStream = response.body
const markdownGenerator = streamHtmlToMarkdown(htmlStream, {
  origin: 'https://example.com'
})

// Process chunks as they arrive
for await (const chunk of markdownGenerator) {
  console.log(chunk)
}
```

**Pure HTML Parser**

If you only need to parse HTML into a DOM-like AST without converting to Markdown, use `parseHtml`:

```ts
import { parseHtml } from 'mdream'

const html = '<div><h1>Title</h1><p>Content</p></div>'
const { events, remainingHtml } = parseHtml(html)

// Process the parsed events
events.forEach((event) => {
  if (event.type === 'enter' && event.node.type === 'element') {
    console.log('Entering element:', event.node.tagName)
  }
})
```

The `parseHtml` function provides:
- **Pure AST parsing** - No markdown generation overhead
- **DOM events** - Enter/exit events for each element and text node
- **Plugin support** - Can apply plugins during parsing
- **Streaming compatible** - Works with the same plugin system

## Presets

Presets are pre-configured combinations of plugins for common use cases.

### Minimal Preset

The `minimal` preset optimizes for token reduction and cleaner output by removing non-essential content:

```ts
import { withMinimalPreset } from 'mdream/preset/minimal'

const options = withMinimalPreset({
  origin: 'https://example.com'
})
```

**Plugins included:**
- `isolateMainPlugin()` - Extracts main content area
- `frontmatterPlugin()` - Generates YAML frontmatter from meta tags
- `tailwindPlugin()` - Converts Tailwind classes to Markdown
- `filterPlugin()` - Excludes forms, navigation, buttons, footers, and other non-content elements

**CLI Usage:**
```bash
curl -s https://example.com | npx mdream --preset minimal --origin https://example.com
```

## Plugin System

The plugin system allows you to customize HTML to Markdown conversion by hooking into the processing pipeline. Plugins can filter content, extract data, transform nodes, or add custom behavior.

### Built-in Plugins

Mdream includes several built-in plugins that can be used individually or combined:

- **[`extractionPlugin`](./src/plugins/extraction.ts)**: Extract specific elements using CSS selectors for data analysis
- **[`filterPlugin`](./src/plugins/filter.ts)**: Include or exclude elements based on CSS selectors or tag IDs
- **[`frontmatterPlugin`](./src/plugins/frontmatter.ts)**: Generate YAML frontmatter from HTML head elements (title, meta tags)
- **[`isolateMainPlugin`](./src/plugins/isolate-main.ts)**: Isolate main content using `<main>` elements or header-to-footer boundaries
- **[`tailwindPlugin`](./src/plugins/tailwind.ts)**: Convert Tailwind CSS classes to Markdown formatting (bold, italic, etc.)
- **[`readabilityPlugin`](./src/plugins/readability.ts)**: Content scoring and extraction (experimental)

```ts
import { filterPlugin, frontmatterPlugin, isolateMainPlugin } from 'mdream/plugins'

const markdown = htmlToMarkdown(html, {
  plugins: [
    isolateMainPlugin(),
    frontmatterPlugin(),
    filterPlugin({ exclude: ['nav', '.sidebar', '#footer'] })
  ]
})
```

### Plugin Hooks

- `beforeNodeProcess`: Called before any node processing, can skip nodes
- `onNodeEnter`: Called when entering an element node
- `onNodeExit`: Called when exiting an element node
- `processTextNode`: Called for each text node
- `processAttributes`: Called to process element attributes

### Creating a Plugin

Use `createPlugin()` to create a plugin with type safety:

```ts
import type { ElementNode, TextNode } from 'mdream'
import { htmlToMarkdown } from 'mdream'
import { createPlugin } from 'mdream/plugins'

const myPlugin = createPlugin({
  onNodeEnter(node: ElementNode) {
    if (node.name === 'h1') {
      return '🔥 '
    }
  },

  processTextNode(textNode: TextNode) {
    // Transform text content
    if (textNode.parent?.attributes?.id === 'highlight') {
      return {
        content: `**${textNode.value}**`,
        skip: false
      }
    }
  }
})

// Use the plugin
const html: string = '<div id="highlight">Important text</div>'
const markdown: string = htmlToMarkdown(html, { plugins: [myPlugin] })
```

### Example: Content Filter Plugin

```ts
import type { ElementNode, NodeEvent } from 'mdream'
import { ELEMENT_NODE } from 'mdream'
import { createPlugin } from 'mdream/plugins'

const adBlockPlugin = createPlugin({
  beforeNodeProcess(event: NodeEvent) {
    const { node } = event

    if (node.type === ELEMENT_NODE && node.name === 'div') {
      const element = node as ElementNode
      // Skip ads and promotional content
      if (element.attributes?.class?.includes('ad')
        || element.attributes?.id?.includes('promo')) {
        return { skip: true }
      }
    }
  }
})
```

### Extraction Plugin

Extract specific elements and their content during HTML processing for data analysis or content discovery:

```ts
import { extractionPlugin, htmlToMarkdown } from 'mdream'

const html: string = `
  <article>
    <h2>Getting Started</h2>
    <p>This is a tutorial about web scraping.</p>
    <img src="/hero.jpg" alt="Hero image" />
  </article>
`

// Extract elements using CSS selectors
const plugin = extractionPlugin({
  'h2': (element: ExtractedElement, state: MdreamRuntimeState) => {
    console.log('Heading:', element.textContent) // "Getting Started"
    console.log('Depth:', state.depth) // Current nesting depth
  },
  'img[alt]': (element: ExtractedElement, state: MdreamRuntimeState) => {
    console.log('Image:', element.attributes.src, element.attributes.alt)
    // "Image: /hero.jpg Hero image"
    console.log('Context:', state.options) // Access to conversion options
  }
})

htmlToMarkdown(html, { plugins: [plugin] })
```

The extraction plugin provides memory-efficient element extraction with full text content and attributes, perfect for SEO analysis, content discovery, and data mining.

## Markdown Splitting

Split HTML into chunks during conversion for LLM context windows, vector databases, or document processing.

### Basic Chunking

```ts
import { TAG_H2 } from 'mdream'
import { htmlToMarkdownSplitChunks } from 'mdream/splitter'

const html = `
  <h1>Documentation</h1>
  <h2>Installation</h2>
  <p>Install via npm...</p>
  <h2>Usage</h2>
  <p>Use it like this...</p>
`

const chunks = htmlToMarkdownSplitChunks(html, {
  headersToSplitOn: [TAG_H2], // Split on h2 headers
  chunkSize: 1000, // Max chars per chunk
  chunkOverlap: 200, // Overlap for context
  stripHeaders: true // Remove headers from content
})

// Each chunk includes content and metadata
chunks.forEach((chunk) => {
  console.log(chunk.content)
  console.log(chunk.metadata.headers) // { h1: "Documentation", h2: "Installation" }
  console.log(chunk.metadata.code) // Language if chunk contains code
  console.log(chunk.metadata.loc) // Line numbers
})
```

### Streaming Chunks (Memory Efficient)

For large documents, use the generator version to process chunks one at a time:

```ts
import { htmlToMarkdownSplitChunksStream } from 'mdream/splitter'

// Process chunks incrementally - lower memory usage
for (const chunk of htmlToMarkdownSplitChunksStream(html, options)) {
  await processChunk(chunk) // Handle each chunk as it's generated

  // Can break early if you found what you need
  if (foundTarget)
    break
}
```

**Benefits of streaming:**
- Lower memory usage - chunks aren't stored in an array
- Early termination - stop processing when you find what you need
- Better for large documents

### Splitting Options

```ts
interface SplitterOptions {
  // Structural splitting
  headersToSplitOn?: number[] // TAG_H1, TAG_H2, etc. Default: [TAG_H2-TAG_H6]

  // Size-based splitting
  chunkSize?: number // Max chunk size. Default: 1000
  chunkOverlap?: number // Overlap between chunks. Default: 200
  lengthFunction?: (text: string) => number // Custom length (e.g., token count)

  // Output formatting
  stripHeaders?: boolean // Remove headers from content. Default: true
  returnEachLine?: boolean // Split into individual lines. Default: false

  // Standard options
  origin?: string // Base URL for links/images
  plugins?: Plugin[] // Apply plugins during conversion
}
```

### Chunk Metadata

Each chunk includes rich metadata for context:

```ts
interface MarkdownChunk {
  content: string
  metadata: {
    headers?: Record<string, string> // Header hierarchy: { h1: "Title", h2: "Section" }
    code?: string // Code block language if present
    loc?: { // Line number range
      lines: { from: number, to: number }
    }
  }
}
```

### Use with Presets

Combine splitting with presets for optimized output:

```ts
import { TAG_H2 } from 'mdream'
import { withMinimalPreset } from 'mdream/preset/minimal'
import { htmlToMarkdownSplitChunks } from 'mdream/splitter'

const chunks = htmlToMarkdownSplitChunks(html, withMinimalPreset({
  headersToSplitOn: [TAG_H2],
  chunkSize: 500,
  origin: 'https://example.com'
}))
```

## llms.txt Generation

Generate [llms.txt](https://llmstxt.org) files from HTML content for improved LLM discoverability. Mdream provides both streaming and batch APIs for creating llms.txt artifacts.

### createLlmsTxtStream

Stream llms.txt generation without keeping full content in memory:

```ts
import { createLlmsTxtStream } from 'mdream'

const stream = createLlmsTxtStream({
  siteName: 'My Docs',
  description: 'Documentation site',
  origin: 'https://example.com',
  outputDir: './dist',
  generateFull: true, // Also generate llms-full.txt
  sections: [
    {
      title: 'Getting Started',
      description: 'Quick start guide',
      links: [
        { title: 'Installation', href: '/install', description: 'How to install' },
        { title: 'Quick Start', href: '/quickstart' },
      ],
    },
  ],
  notes: ['Generated by mdream', 'Last updated: 2024'],
})

const writer = stream.getWriter()
await writer.write({
  title: 'Home',
  content: '# Welcome\n\nHome page content.',
  url: '/',
  metadata: {
    description: 'Welcome page',
  },
})
await writer.close()
```

This creates:
- `llms.txt` - Links to all pages with metadata
- `llms-full.txt` - Complete content with frontmatter (if `generateFull: true`)

### generateLlmsTxtArtifacts

Process HTML files or ProcessedFile objects:

```ts
import { generateLlmsTxtArtifacts } from 'mdream'

const result = await generateLlmsTxtArtifacts({
  patterns: '**/*.html', // Glob pattern for HTML files
  siteName: 'My Site',
  origin: 'https://example.com',
  generateFull: true,
  sections: [
    {
      title: 'Resources',
      links: [
        { title: 'Docs', href: '/docs' },
      ],
    },
  ],
  notes: 'Footer notes',
})

console.log(result.llmsTxt) // llms.txt content
console.log(result.llmsFullTxt) // llms-full.txt content
console.log(result.processedFiles) // Array of processed files
```

### Structure

llms.txt follows this structure:

```markdown
# Site Name

> Site description

## Custom Section

Section description

- [Link Title](url): Optional description

## Pages

- [Page Title](url): Page description

Custom notes
```

## Credits

- [ultrahtml](https://github.com/natemoo-re/ultrahtml): HTML parsing inspiration

## License

Licensed under the [MIT license](https://github.com/harlan-zw/mdream/blob/main/LICENSE.md).

<!-- Badges -->
[npm-version-src]: https://img.shields.io/npm/v/mdream/latest.svg?style=flat&colorA=18181B&colorB=4C9BE0
[npm-version-href]: https://npmjs.com/package/mdream

[npm-downloads-src]: https://img.shields.io/npm/dm/mdream.svg?style=flat&colorA=18181B&colorB=4C9BE0
[npm-downloads-href]: https://npmjs.com/package/mdream

[license-src]: https://img.shields.io/github/license/harlan-zw/mdream.svg?style=flat&colorA=18181B&colorB=4C9BE0
[license-href]: https://github.com/harlan-zw/mdream/blob/main/LICENSE.md
