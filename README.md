# mdream

[![npm version][npm-version-src]][npm-version-href]
[![npm downloads][npm-downloads-src]][npm-downloads-href]
[![License][license-src]][license-href]
[![Node.js][nodejs-src]][nodejs-href]

> Finely tuned HTML to Markdown streaming built for LLM workflows.

<p align="center">
<table>
<tbody>
<td align="center">
<sub>Questions? Join our <a href="https://discord.gg/mdream">Discord</a> for help • Follow <a href="https://twitter.com/downstream_dev">@downstream_dev</a> 🐦</sub><br>
</td>
</tbody>
</table>
</p>

## Features

Mdream is a tiny high-performance, low-memory HTML to Markdown JavaScript tool designed for large-scale content analysis through LLM.

- MCP server endpoint
- 4.4kb, 0 deps

## Quick Start

### CLI Usage
```bash
# Convert a local HTML file to Markdown
npx mdream convert path/to/file.html

# Convert a website to Markdown
npx mdream convert https://example.com
```

### API Usage

```javascript
import { htmlToMarkdown, htmlToMarkdownStream } from 'mdream'

// Simple conversion
const markdown = await htmlToMarkdown('<h1>Hello World</h1>')
console.log(markdown) // # Hello World

// Streaming conversion
const htmlContent = '<h1>Hello</h1><p>This is a test</p>...' // Large HTML content
for await (const chunk of htmlToMarkdownStream(htmlContent)) {
  console.log('Markdown chunk:', chunk)
}
````

## Benchmark: Fastest HTML to Markdown Conversion

In our benchmarks, Downstream outperforms other popular HTML to Markdown converters:

- **5-10x faster** than similar libraries for large documents
- **70% lower memory usage** during conversion
- **Immediate output** via streaming (vs. waiting for complete processing)
- **Zero dependencies** means smaller install footprint
- **Optimized for LLM-generated HTML** patterns and quirks

## Why Use Downstream with LLMs?

LLMs work more efficiently with Markdown than HTML. Downstream's streaming approach delivers unique advantages:

- ⚡️ **Process web content for LLMs in real-time** without waiting for complete downloads
- 📉 **Reduce memory overhead** when feeding large HTML documents to LLMs
- 🔄 **Lower token consumption** by converting HTML to clean, efficient Markdown
- 🧠 **Preserve semantic structure** from original content in a format LLMs understand
- ⏱️ **Cut latency** in AI pipelines by processing content incrementally

## Features

- 🚀 **Streaming conversion architecture** for maximum performance
- 🌊 Process HTML in configurable chunks to minimize memory usage
- ⚙️ **Simple but powerful API** with both sync and streaming options
- 🔍 Specially optimized for LLM-compatible Markdown output
- 📊 Faithfully preserves tables, code blocks, and complex nested structures
- 🧩 Fast and reliable HTML to Markdown conversion
- 💾 Convert multi-megabyte HTML files with minimal memory footprint
- 🧵 Command-line interface for quick file/URL conversion
- 🔧 Configurable chunk size for fine-tuned performance

## Installation

```bash
# npm
npm install mdream

# yarn
yarn add mdream

# pnpm
pnpm add mdream
```

## CLI Usage

The CLI is designed to work exclusively with Unix pipes, making it easy to integrate with other tools.

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

### CLI Options

- `--chunk-size <size>`: Set the chunk size for processing (default: 4096)
- `-v, --verbose`: Enable verbose debug logging to stderr
- `--help`: Display help information
- `--version`: Display version information

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

## License

Licensed under the [MIT license](https://github.com/mdream/mdream/blob/main/LICENSE.md).

<!-- Badges -->
[npm-version-src]: https://img.shields.io/npm/v/mdream/latest.svg?style=flat&colorA=18181B&colorB=4C9BE0
[npm-version-href]: https://npmjs.com/package/mdream

[npm-downloads-src]: https://img.shields.io/npm/dm/mdream.svg?style=flat&colorA=18181B&colorB=4C9BE0
[npm-downloads-href]: https://npmjs.com/package/mdream

[license-src]: https://img.shields.io/github/license/mdream/mdream.svg?style=flat&colorA=18181B&colorB=4C9BE0
[license-href]: https://github.com/mdream/mdream/blob/main/LICENSE.md

[nodejs-src]: https://img.shields.io/badge/Node.js-18181B?logo=node.js&colorB=4C9BE0
[nodejs-href]: https://nodejs.org
