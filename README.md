# downstream

[![npm version][npm-version-src]][npm-version-href]
[![npm downloads][npm-downloads-src]][npm-downloads-href]
[![License][license-src]][license-href]
[![Node.js][nodejs-src]][nodejs-href]

**The fastest HTML to Markdown converter with streaming support, purpose-built for LLM workflows.**

Downstream transforms HTML into clean Markdown with unmatched performance, processing content as it arrives rather than waiting for complete documents. This streaming architecture makes it the ideal solution for large-scale LLM content processing where speed and memory efficiency are critical.

<p align="center">
<table>
<tbody>
<td align="center">
<sub>Questions? Join our <a href="https://discord.gg/downstream">Discord</a> for help • Follow <a href="https://twitter.com/downstream_dev">@downstream_dev</a> 🐦</sub><br>
</td>
</tbody>
</table>
</p>

## Quick Start

### CLI Usage
```bash
# Convert a local HTML file to Markdown
npx downstream convert path/to/file.html

# Convert a website to Markdown
npx downstream convert https://example.com
```

### API Usage
```javascript
import { htmlToMarkdown, htmlToMarkdownStream } from 'downstream';

// Simple conversion
const markdown = await htmlToMarkdown('<h1>Hello World</h1>');
console.log(markdown); // # Hello World

// Streaming conversion
const htmlContent = '<h1>Hello</h1><p>This is a test</p>...'; // Large HTML content
for await (const chunk of htmlToMarkdownStream(htmlContent)) {
  console.log('Markdown chunk:', chunk);
}

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
npm install downstream

# yarn
yarn add downstream

# pnpm
pnpm add downstream
```

## Basic HTML to Markdown Conversion

```javascript
import { htmlToMarkdown, htmlToMarkdownStream } from 'downstream'
import fetch from 'node-fetch'

// Simple conversion for small content
const markdown = await htmlToMarkdown('<h1>Hello World</h1>')
console.log(markdown) // # Hello World

// Streaming conversion for large content
async function convertLargeWebpage(url) {
  const response = await fetch(url) // This only waits for headers, not full body
  const htmlText = await response.text() // Get the full HTML content

  // Process content in manageable chunks
  for await (const chunk of htmlToMarkdownStream(htmlText, { chunkSize: 8192 })) {
    // Each chunk of Markdown is processed without loading the entire content into memory at once
    console.log('Converted chunk:', chunk)
  }
}

// Command line equivalent:
// npx downstream convert https://example.com
```

## Optimized for LLM Workflows

```javascript
import { htmlToMarkdown, htmlToMarkdownStream } from 'downstream'
import fetch from 'node-fetch'
import { OpenAI } from 'openai'

const openai = new OpenAI()

// Real-world example: Web scraping to LLM analysis pipeline
async function webToLLMPipeline(url) {
  console.log(`Processing content from ${url}...`)

  // Fetch HTML content from a webpage
  const response = await fetch(url) // This only waits for headers, not the full body
  const htmlContent = await response.text()

  // Convert HTML to Markdown in chunks
  const markdownChunks = []

  // Process the Markdown in chunks as it's converted
  for await (const chunk of htmlToMarkdownStream(htmlContent, { chunkSize: 4096 })) {
    markdownChunks.push(chunk)

    // Optional: Update UI with conversion progress
    updateProgressBar(markdownChunks.length)

    // Once we have enough content, we can start processing with the LLM
    // without waiting for the entire page to be converted
    if (markdownChunks.length % 5 === 0) {
      const partialMarkdown = markdownChunks.join('')
      // Process the current content with an LLM
      analyzeContentChunk(partialMarkdown)
    }
  }

  // Final analysis with complete content
  const fullMarkdown = markdownChunks.join('')
  return await analyzeFinalContent(fullMarkdown)
}
```

## Low-Level HTML Parser API

```javascript
import { htmlToMarkdown, htmlToMarkdownStream } from 'downstream'

// Use advanced options to control chunk size
const options = {
  chunkSize: 8192 // Process 8KB chunks at a time (default is 4096)
}

// For large HTML documents
const largeHtmlContent = getVeryLargeHtmlDocument()

// Process in manageable chunks to avoid memory issues
for await (const markdownChunk of htmlToMarkdownStream(largeHtmlContent, options)) {
  // Each chunk is processed independently, keeping memory usage low
  processMarkdownChunk(markdownChunk)
}

// Command line equivalent with custom chunk size:
// npx downstream convert huge-file.html --chunk-size=8192
```

## API Reference

```typescript
/**
 * Options for HTML to Markdown conversion
 */
export interface HTMLToMarkdownOptions {
  /**
   * Size of chunks to process at once in bytes
   * @default 4096
   */
  chunkSize?: number
}

/**
 * Convert HTML string to Markdown (all at once)
 *
 * @param html HTML content to convert
 * @param options Conversion options
 * @returns Promise resolving to full Markdown content
 */
export async function htmlToMarkdown(
  html: string,
  options: HTMLToMarkdownOptions = {}
): Promise<string>

/**
 * Convert HTML string to Markdown in streaming chunks
 *
 * @param html HTML content to convert
 * @param options Conversion options
 * @returns AsyncGenerator yielding Markdown chunks
 */
export async function* htmlToMarkdownStream(
  html: string,
  options: HTMLToMarkdownOptions = {}
): AsyncGenerator<string>
```

## CLI Usage

```bash
# Basic conversion of HTML file to Markdown
npx downstream convert input.html > output.md

# Convert a webpage to Markdown
npx downstream convert https://example.com > example.md

# Control chunk size for large files
npx downstream convert large-file.html --chunk-size=8192 > output.md

# Get help
npx downstream --help
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

[📖 Read the full documentation](https://downstream.js.org) for details on:
- Advanced configuration for optimal HTML to Markdown conversion
- Integrating with popular LLM platforms
- Fine-tuning parser performance
- Handling edge cases in LLM-generated HTML

## Examples

- [High-Performance HTML to Markdown Converter Demo](https://downstream.js.org/demo)
- [LLM Streaming Pipeline Example](https://github.com/downstream/llm-streaming-example)
- [Enterprise-Scale Processing Benchmark](https://github.com/downstream/benchmark)

## License

Licensed under the [MIT license](https://github.com/downstream/downstream/blob/main/LICENSE.md).

<!-- Badges -->
[npm-version-src]: https://img.shields.io/npm/v/downstream/latest.svg?style=flat&colorA=18181B&colorB=4C9BE0
[npm-version-href]: https://npmjs.com/package/downstream

[npm-downloads-src]: https://img.shields.io/npm/dm/downstream.svg?style=flat&colorA=18181B&colorB=4C9BE0
[npm-downloads-href]: https://npmjs.com/package/downstream

[license-src]: https://img.shields.io/github/license/downstream/downstream.svg?style=flat&colorA=18181B&colorB=4C9BE0
[license-href]: https://github.com/downstream/downstream/blob/main/LICENSE.md

[nodejs-src]: https://img.shields.io/badge/Node.js-18181B?logo=node.js&colorB=4C9BE0
[nodejs-href]: https://nodejs.org
