<h1>mdream</h1>

[![npm version](https://img.shields.io/npm/v/mdream?color=yellow)](https://npmjs.com/package/mdream)
[![npm downloads](https://img.shields.io/npm/dm/mdream?color=yellow)](https://npm.chart.dev/mdream)
[![license](https://img.shields.io/github/license/mdream/mdream?color=yellow)](https://github.com/harlan-zw/mdream/blob/main/LICENSE.md)

<img src=".github/logo.png" alt="mdream logo" width="300">

> Ultra performant HTML to Markdown built for LLM content analysis.

<p align="center">
<table>
<tbody>
<td align="center">
<sub>Made possible by my <a href="https://github.com/sponsors/harlan-zw">Sponsor Program 💖</a><br> Follow me <a href="https://twitter.com/harlan_zw">@harlan_zw</a> 🐦 • Join <a href="https://discord.gg/275MBUBvgP">Discord</a> for help</sub><br>
</td>
</tbody>
</table>
</p>

Traditional HTML to Markdown converters are either slow and bloated with dependencies or produce output poorly suited for LLMs and content analysis.

Mdream is a high-performance, streaming HTML to Markdown parser built specifically for LLM pipelines. With zero dependencies, ultra-low memory usage, and opinionated output optimized for both human readability and AI processing.

Perfect for: RAG systems, web scraping, content extraction, ChatGPT/Claude integration, and large-scale document processing.

## Features

- 🚀 Streaming Conversion Architecture: Process web content in real-time with minimal memory overhead.
- 📉 LLM Optimization: Reduce token usage by converting HTML to efficient Markdown.
- 🔍 Advanced Content Preservation: Maintain tables, code blocks, and complex structures accurately.
- ⚙️ Flexible Implementation: Simple API with sync/streaming options and command-line interface.
- ⚡ Ultra Fast Performance: Tiny 4.4kb footprint, zero dependencies, and 5-10x faster than similar libraries.
- 🔄 Parallel Processing: Use worker threads to process HTML chunks in parallel for even faster performance.

### Opinionated Parsing

Mdream supports parsing partial HTML content as well as full documents. When working with full documents, Mdream
will attempt to create "clean" markdown.

Clean markdown is considered the actual "content" of the page, we want to avoid all of the boilerplate
around the content of the site such as the header, footer, asides, and extra nav links.

This is due

## CLI Usage

The Mdream CLI is designed to work exclusively with Unix pipes, providing full more flexibility in implementation
and making it easy to integrate with other tools.

**Pipe Site to Markdown**

```bash
curl -s https://en.wikipedia.org/wiki/Markdown \
 | npx mdream --origin https://en.wikipedia.org \
  | tee streaming.md
```

_Tip: The `--origin` flag will fix relative image and links paths_

**Local File to Markdown**

```bash
cat index.html \
 | npx mdream \
  | tee streaming.md
```

### CLI Options

- `--chunk-size <size>`: Set the chunk size for processing (default: 4096)
- `-v, --verbose`: Enable verbose debug logging to stderr
- `--workers <count>`: Number of worker threads to use for parallel processing (default: 4)
- `--no-workers`: Disable worker threads and process in a single thread
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
- `asyncHtmlToMarkdown`: Useful if you already have the entire HTML payload you want to convert.
- `streamHtmlToMarkdown`: Best practice if you are fetching or reading from a local file.

**Convert existing HTML**

```ts
import { asyncHtmlToMarkdown } from 'mdream'

// Simple conversion
const markdown = await asyncHtmlToMarkdown('<h1>Hello World</h1>')
console.log(markdown) // # Hello World
````

**Convert from Fetch**

```ts
import { streamHtmlToMarkdown } from 'mdream'

const response = await fetch('https://example.com')
const htmlStream = response.body
const markdownStream = streamHtmlToMarkdown(htmlStream, {
  origin: 'https://example.com'
  // Workers are enabled by default with 4 threads
  // You can customize with useWorkers: false or workerCount: n
})

// Process the markdown stream
for await (const chunk of markdownStream) {
  console.log(chunk)
}
```

**Worker Configuration**

```ts
// OPTION 1: Automatic detection (recommended)
// Default behavior automatically uses the right worker type for your environment
import { asyncHtmlToMarkdown } from 'mdream'

const markdown = await asyncHtmlToMarkdown(html)

// OPTION 2: Explicit worker configuration
import { asyncHtmlToMarkdown } from 'mdream'
import { worker, createWorker } from 'mdream/worker'

// Using the worker factory directly
const markdown = await asyncHtmlToMarkdown(html, {
  worker: {
    factory: worker,
    maxWorkers: 4 // Optional: control number of workers
  }
})

// Or using the helper function
const markdown = await asyncHtmlToMarkdown(html, {
  worker: createWorker({ maxWorkers: 4 })
})

// OPTION 3: Disable workers completely
import { asyncHtmlToMarkdown } from 'mdream'

const markdown = await asyncHtmlToMarkdown(html, {
  useWorkers: false
})
console.log(markdown)
```

See [examples/workers-usage.md](examples/workers-usage.md) for more examples.

## CLI Usage

```bash
# Basic usage
cat example.html | html2md > example.md

# Adjust chunk size for very large files
cat large.html | html2md --chunk-size 8192 > large.md

# Enable verbose mode to see processing details
cat troublesome.html | html2md --verbose > troublesome.md

# Combine with other Unix tools
curl https://example.com | html2md | grep "important" > filtered.md
```

## Documentation

[📖 Read the full documentation](https://mdream.js.org) for details on:
- Advanced configuration for optimal HTML to Markdown conversion
- Integrating with popular LLM platforms
- Fine-tuning parser performance
- Handling edge cases in LLM-generated HTML

## Examples

- [High-Performance HTML to Markdown Converter Demo](https://mdream.js.org/demo)
- [LLM Streaming Pipeline Example](https://github.com/mdream/llm-streaming-example)
- [Enterprise-Scale Processing Benchmark](https://github.com/mdream/benchmark)

## Credits

Inspired by the work of:

- [ultrahtml](https://github.com/natemoo-re/ultrahtml): HTML parsing

## License

Licensed under the [MIT license](https://github.com/mdream/mdream/blob/main/LICENSE.md).

<!-- Badges -->
[npm-version-src]: https://img.shields.io/npm/v/mdream/latest.svg?style=flat&colorA=18181B&colorB=4C9BE0
[npm-version-href]: https://npmjs.com/package/mdream

[npm-downloads-src]: https://img.shields.io/npm/dm/mdream.svg?style=flat&colorA=18181B&colorB=4C9BE0
[npm-downloads-href]: https://npmjs.com/package/mdream

[license-src]: https://github.com/mdream/mdream/blob/main/LICENSE.mdhttps://img.shields.io/github/license/mdream/mdream.svg?style=flat&colorA=18181B&colorB=4C9BE0
[license-href]:
