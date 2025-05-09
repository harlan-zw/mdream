<h1>mdream</h1>

[![npm version](https://img.shields.io/npm/v/mdream?color=yellow)](https://npmjs.com/package/mdream)
[![npm downloads](https://img.shields.io/npm/dm/mdream?color=yellow)](https://npm.chart.dev/mdream)
[![license](https://img.shields.io/github/license/mdream/mdream?color=yellow)](https://github.com/harlan-zw/mdream/blob/main/LICENSE.md)

> Universal HTML to Markdown streamer optimized for LLMs & Human readability

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

- 🤖 LLM & Human Optimized: [Opinionated Markdown](#opinionated-markdown) output maximised for on-page content.
- 🚀 Fast: Convert 1.4MB of HTML in [~65 ms*]() with streaming support.
- ⚡ Tiny: 5kB gzip, zero dependencies.
- 🔍 Optimized Markdown: Frontmatter, GitHub Flavored with nested markup support.
- ⚙️ Run anywhere: CLI, edge workers, browsers, Node, etc.

## Why Mdream?

Traditional HTML to Markdown converters were not built for LLMs or humans. They tend to be slow and bloated and produce output that's poorly suited for LLMs token usage or for
human readability.

Mdream is a ultra-performant, HTML to Markdown convertor built specifically for LLM Content Analysis & Humans Readibility. With zero dependencies, streaming built-in and opinionated output optimized for both human readability and AI processing.

Perfect for: RAG systems, web scraping, content extraction, ChatGPT/Claude integration, and large-scale document processing.

## CLI Usage

The Mdream CLI is designed to work exclusively with Unix pipes, providing flexibility and freedom to integrate with other tools.

**Pipe Site to Markdown**

Fetches the [Markdown Wikipedia page](https://en.wikipedia.org/wiki/Markdown) and converts it to Markdown whilst
preserving the original links and images.

```bash
curl -s https://en.wikipedia.org/wiki/Markdown \
 | npx mdream --origin https://en.wikipedia.org --filters minimal-from-first-header \
  | tee streaming.md
```

_Tip: The `--origin` flag will fix relative image and links paths_

**Local File to Markdown**

Converts a local HTML file to a Markdown file, using `tee` to write the output to a file and display it in the terminal.

```bash
cat index.html \
 | npx mdream \
  | tee streaming.md
```

### CLI Options

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

fetch()
```

## Documentation

### Filters: Opinionated Markdown

Most HTML to Markdown convertors produce a lot of noise. Mdream aims to filter out noise providing more right LLM content analysis and in turn a reduction in token usage.

A reduction in noise also makes it much easier for humans to read Markdown as well.

To solve the issue of noise, Mdream implements the concept of "strategies". A filters being logic

While using the the filters `minimal`, `from-first:h1` is advised, you may find it's too restrictive for your use case. In that case, you can avoid any applying any strategies at all to
parse the entire HTML document.

| filters | Description |
| -------- | ----------- |
| `minimal` | This filters will parse the HTML document and extract the main content, ignoring all other content. It will also remove any boilerplate content such as headers, footers, and sidebars. This is useful for extracting the main content of a page without any boilerplate. |
| `from-first:h1` | This filters will start parsing the HTML from the first header tag it finds. It will ignore all content before that header tag, including the `<head>` and `<body>` tags. This is useful for extracting the main content of a page without any boilerplate. |

## Credits

- [ultrahtml](https://github.com/natemoo-re/ultrahtml): HTML parsing inspiration

## License

Licensed under the [MIT license](https://github.com/mdream/mdream/blob/main/LICENSE.md).

<!-- Badges -->
[npm-version-src]: https://img.shields.io/npm/v/mdream/latest.svg?style=flat&colorA=18181B&colorB=4C9BE0
[npm-version-href]: https://npmjs.com/package/mdream

[npm-downloads-src]: https://img.shields.io/npm/dm/mdream.svg?style=flat&colorA=18181B&colorB=4C9BE0
[npm-downloads-href]: https://npmjs.com/package/mdream

[license-src]: https://github.com/mdream/mdream/blob/main/LICENSE.mdhttps://img.shields.io/github/license/mdream/mdream.svg?style=flat&colorA=18181B&colorB=4C9BE0
[license-href]:
