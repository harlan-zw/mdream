<h1>mdream</h1>

[![npm version](https://img.shields.io/npm/v/mdream?color=yellow)](https://npmjs.com/package/mdream)
[![npm downloads](https://img.shields.io/npm/dm/mdream?color=yellow)](https://npm.chart.dev/mdream)
[![license](https://img.shields.io/github/license/harlan-zw/mdream?color=yellow)](https://github.com/harlan-zw/mdream/blob/main/LICENSE.md)

> Ultra-performant JavaScript HTML to Markdown converter optimized for LLMs.

<img src=".github/logo.png" alt="mdream logo" width="200">

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

- 🧠 Content Extraction: [Readability.js]() scoring heuristics for [~50% fewer tokens*]() and improved accuracy.
- 🔍 GitHub Flavored Markdown: Frontmatter, Nested & HTML markup support.
- Tailwind CSS: Converts Tailwind CSS classes to Markdown for better readability.

**Ultra Performant**
- 🚀 Convert 1.4MB of HTML in [~50ms*]() with advanced streaming support, including content-based buffering.
- ⚡ 5kB gzip, zero dependencies.
- Streaming support

**Adaptable**

- ⚙️ Run anywhere: CLI, edge workers, browsers, Node, etc.
- 🔌 Extensible: [Plugin system](#plugin-system) for customizing and extending functionality.

**CLI**

- integrates with crawlee to provide entire site markdown dumps
- Run a MCP web server

## Why Mdream?

Traditional HTML to Markdown converters were not built for LLMs or humans. They tend to be slow and bloated and produce output that's poorly suited for LLMs token usage or for
human readability.

Other LLM specific convertors focus on supporting _all_ document formats, resulting in larger bundles and lower quality Markdown output.

Mdream is an ultra-performant HTML to Markdown converter built specifically for producing high-quality Markdown for LLMs as quickly as possible. It provides
a powerful plugin system to customize the conversion process, allowing you to extract, transform, and filter content as needed.

## CLI Usage

The Mdream CLI is designed to work exclusively with Unix pipes, providing flexibility and freedom to integrate with other tools.

**Pipe Site to Markdown**

Fetches the [Markdown Wikipedia page](https://en.wikipedia.org/wiki/Markdown) and converts it to Markdown preserving the original links and images.

```bash
curl -s https://en.wikipedia.org/wiki/Markdown \
 | npx mdream --origin https://en.wikipedia.org --filters minimal-from-first-header \
  | tee streaming.md
```

_Tip: The `--origin` flag will fix relative image and link paths_

**Local File to Markdown**

Converts a local HTML file to a Markdown file, using `tee` to write the output to a file and display it in the terminal.

```bash
cat index.html \
 | npx mdream \
  | tee streaming.md
```

### CLI Options

- `--origin <url>`: Base URL for resolving relative links and images
- `-v, --verbose`: Enable verbose debug logging to stderr
- `--help`: Display help information
- `--version`: Display version information

## API Usage

### Installation

```bash
# npm
npm install mdream

# yarn
yarn add mdream

# pnpm
pnpm add mdream
```

### Usage

Mdream provides two utils for working with HTML, both will process content as a stream.
- `htmlToMarkdown`: Useful if you already have the entire HTML payload you want to convert.
- `streamHtmlToMarkdown`: Best practice if you are fetching or reading from a local file.

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
  origin: 'https://example.com',
  filters: 'minimal-from-first-header'
})

// Process chunks as they arrive
for await (const chunk of markdownGenerator) {
  console.log(chunk)
}
```

## Documentation

### Plugin System

The plugin system allows you to customize HTML to Markdown conversion by hooking into the processing pipeline. Plugins can filter content, extract data, transform nodes, or add custom behavior.

#### Plugin Hooks

- `beforeNodeProcess`: Called before any node processing, can skip nodes
- `onNodeEnter`: Called when entering an element node
- `onNodeExit`: Called when exiting an element node
- `processTextNode`: Called for each text node
- `processAttributes`: Called to process element attributes

#### Creating a Plugin

Use `createPlugin()` to create a plugin with type safety:

```ts
import type { ElementNode, TextNode } from 'mdream'
import { htmlToMarkdown } from 'mdream'
import { createPlugin } from 'mdream/plugins'

const myPlugin = createPlugin({
  onNodeEnter(node: ElementNode): string | undefined {
    if (node.name === 'h1') {
      return '🔥 '
    }
  },

  processTextNode(textNode: TextNode): { content: string, skip: boolean } | undefined {
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

#### Example: Content Filter Plugin

```ts
import type { ElementNode, NodeEvent } from 'mdream'
import { ELEMENT_NODE } from 'mdream'
import { createPlugin } from 'mdream/plugins'

const adBlockPlugin = createPlugin({
  beforeNodeProcess(event: NodeEvent): { skip: boolean } | undefined {
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

#### Extraction Plugin

Extract specific elements and their content during HTML processing for data analysis or content discovery:

```ts
import type { ExtractedElement } from 'mdream/plugins'
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
  'h2': (element: ExtractedElement): void => {
    console.log('Heading:', element.textContent) // "Getting Started"
  },
  'img[alt]': (element: ExtractedElement): void => {
    console.log('Image:', element.attributes.src, element.attributes.alt)
    // "Image: /hero.jpg Hero image"
  }
})

htmlToMarkdown(html, { plugins: [plugin] })
```

The extraction plugin provides memory-efficient element extraction with full text content and attributes, perfect for SEO analysis, content discovery, and data mining.

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
