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
- ⚡ Tiny: 10kB gzip JS core, 45kB gzip with Rust WASM engine. Zero dependencies.
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

### Engines

Mdream includes two rendering engines, automatically selecting the best one for your environment:
- **Rust Engine** (default in Node.js): Native NAPI performance, ~3-4x faster. Bundled as optional dependencies.
- **JavaScript Engine** (default in browser/edge): Zero-dependencies, works everywhere.

```ts
import { htmlToMarkdown } from 'mdream'

// Rust NAPI engine used automatically in Node.js
// JS engine used in browser/edge runtimes
const markdown = htmlToMarkdown('<h1>Hello World</h1>')
```

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

## Declarative Options (Rust Engine)

The default Rust engine uses declarative configuration:

```ts
import { htmlToMarkdown } from 'mdream'

const markdown = htmlToMarkdown(html, {
  origin: 'https://example.com',
  minimal: true, // enables frontmatter, isolateMain, tailwind, filter
  clean: true, // enable all post-processing cleanup
  frontmatter: fm => console.log(fm), // callback for extracted frontmatter
  filter: { exclude: ['nav', '.sidebar'] },
  extraction: {
    'h2': el => console.log('Heading:', el.textContent),
    'img[alt]': el => console.log('Image:', el.attributes.src),
  },
  tagOverrides: { 'custom-tag': { alias: 'div' } },
})
```

### Available Options

| Option | Type | Description |
|--------|------|-------------|
| `origin` | `string` | Base URL for resolving relative links/images |
| `minimal` | `boolean` | Enable minimal preset (frontmatter, isolateMain, tailwind, filter) |
| `clean` | `boolean \| CleanOptions` | Post-processing cleanup (`true` for all, or pick specific) |
| `frontmatter` | `boolean \| (fm) => void \| FrontmatterConfig` | Extract frontmatter from HTML head |
| `isolateMain` | `boolean` | Isolate main content area |
| `tailwind` | `boolean` | Convert Tailwind classes to Markdown |
| `filter` | `{ include?, exclude?, processChildren? }` | Filter elements by CSS selectors |
| `extraction` | `Record<string, (el) => void>` | Extract elements matching CSS selectors |
| `tagOverrides` | `Record<string, TagOverride \| string>` | Override tag rendering behavior |

### Content Extraction with Readability

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

This pipeline gives you battle-tested content extraction + fast markdown conversion.

## Hook-Based Plugins (JS Engine)

For custom hook-based plugins, use `@mdream/js`:

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
  }
})

const markdown = htmlToMarkdown(html, { plugins: [myPlugin] })
```

### Plugin Hooks

- `beforeNodeProcess`: Called before any node processing, can skip nodes
- `onNodeEnter`: Called when entering an element node
- `onNodeExit`: Called when exiting an element node
- `processTextNode`: Called for each text node
- `processAttributes`: Called to process element attributes

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

For llms.txt artifact generation, use `@mdream/js/llms-txt`. It accepts pre-converted markdown and generates `llms.txt` and `llms-full.txt` artifacts.

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

## Credits

- [ultrahtml](https://github.com/natemoo-re/ultrahtml): HTML parsing inspiration

## License

Licensed under the [MIT license](https://github.com/harlan-zw/mdream/blob/main/LICENSE.md).

