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

Mdream is an ultra-performant HTML to Markdown converter built specifically for LLM Content Analysis & Human Readability. With zero dependencies, streaming built-in and opinionated output optimized for both human readability and AI processing.

Perfect for: RAG systems, web scraping, content extraction, ChatGPT/Claude integration, and large-scale document processing.

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
- `syncHtmlToMarkdown`: Useful if you already have the entire HTML payload you want to convert.
- `streamHtmlToMarkdown`: Best practice if you are fetching or reading from a local file.

**Convert existing HTML**

```ts
import { syncHtmlToMarkdown } from 'mdream'

// Simple conversion
const markdown = syncHtmlToMarkdown('<h1>Hello World</h1>')
console.log(markdown) // # Hello World
````

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

Mdream now features a powerful plugin system that allows you to customize and extend the HTML-to-Markdown conversion process.

```ts
import { createPlugin, filterUnsupportedTags, syncHtmlToMarkdown, withTailwind } from 'mdream'

// Create a custom plugin
const myPlugin = createPlugin({
  name: 'my-plugin',
  transformContent: (content, node) => {
    if (node.type === 1 && node.name === 'div' && node.attributes?.role === 'alert') {
      return `⚠️ ${content} ⚠️`
    }
    return content
  }
})

// Use multiple plugins together
const html = '<div role="alert" class="font-bold">Important message</div>'
const markdown = syncHtmlToMarkdown(html, {
  plugins: [
    withTailwind(), // Apply Tailwind class processing
    filterUnsupportedTags(), // Filter out unsupported tags
    myPlugin // Apply custom transformations
  ]
})

console.log(markdown) // "⚠️ **Important message** ⚠️"
```

For more details, see the [plugin documentation](./docs/plugins.md).

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
