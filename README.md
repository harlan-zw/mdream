# mdream

[![npm version][npm-version-src]][npm-version-href]
[![npm downloads][npm-downloads-src]][npm-downloads-href]
[![License][license-src]][license-href]
[![Node.js][nodejs-src]][nodejs-href]

> Ultra performant HTML to Markdown streaming built for LLM workflows.

<p align="center">
<table>
<tbody>
<td align="center">
<sub>Made possible by my <a href="https://github.com/sponsors/harlan-zw">Sponsor Program 💖</a><br> Follow me <a href="https://twitter.com/harlan_zw">@harlan_zw</a> 🐦 • Join <a href="https://discord.gg/275MBUBvgP">Discord</a> for help</sub><br>
</td>
</tbody>
</table>
</p>

Mdream is an opinionated, high-performance HTML to Markdown TypeScript package designed for large-scale content analysis through LLM. It can
be used as a CLI or a package.

It's inspired by modern HTML parsing tools like [ultrahtml](https://github.com/natemoo-re/ultrahtml).

## Features

- 🚀 Streaming Conversion Architecture: Process web content in real-time with minimal memory overhead.
- 📉 LLM Optimization: Reduce token usage by converting HTML to efficient Markdown.
- 🔍 Advanced Content Preservation: Maintain tables, code blocks, and complex structures accurately.
- ⚙️ Flexible Implementation: Simple API with sync/streaming options and command-line interface.
- ⚡ Ultra Fast Performance: Tiny 4.4kb footprint, zero dependencies, and 5-10x faster than similar libraries.

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

fetch()
```

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

## License

Licensed under the [MIT license](https://github.com/mdream/mdream/blob/main/LICENSE.md).

<!-- Badges -->
[npm-version-src]: https://img.shields.io/npm/v/mdream/latest.svg?style=flat&colorA=18181B&colorB=4C9BE0
[npm-version-href]: https://npmjs.com/package/mdream

[npm-downloads-src]: https://img.shields.io/npm/dm/mdream.svg?style=flat&colorA=18181B&colorB=4C9BE0
[npm-downloads-href]: https://npmjs.com/package/mdream

[license-src]: https://github.com/mdream/mdream/blob/main/LICENSE.mdhttps://img.shields.io/github/license/mdream/mdream.svg?style=flat&colorA=18181B&colorB=4C9BE0
[license-href]:
