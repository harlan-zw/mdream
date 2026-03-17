<h1>mdream</h1>

[![npm version](https://img.shields.io/npm/v/mdream?color=yellow)](https://npmjs.com/package/mdream)
[![npm downloads](https://img.shields.io/npm/dm/mdream?color=yellow)](https://npm.chart.dev/mdream)
[![license](https://img.shields.io/github/license/harlan-zw/mdream?color=yellow)](https://github.com/harlan-zw/mdream/blob/main/LICENSE.md)

> ☁️ The fastest HTML to markdown convertor built with JavaScript and Rust. Optimized for LLMs and supports streaming.

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

- 🧠 #1 Token Optimizer: [Up to 2x fewer tokens](#token-reduction) than Turndown, node-html-markdown, and html-to-markdown. 70-99% fewer tokens than raw HTML.
- 🚀 #1 Fastest: [Fastest pure JS & native rust](#benchmarks) - 35x faster than Turndown, converts 1.8MB HTML in ~62ms (JS) and ~3.9ms (Rust with PGO).
- 🔍 Generates [Minimal](./packages/mdream/src/preset/minimal.ts) GitHub Flavored Markdown: Frontmatter, Nested & HTML markup support. Clean mode strips broken links, empty images, redundant anchors.
- 🌊 Streamable: Process HTML incrementally with `streamHtmlToMarkdown()` for large documents and real-time pipelines.
- ⚡ Tiny: 10kB gzip JS core, 60kB gzip with Rust WASM engine. Zero dependencies.
- ⚙️ Run anywhere: [CLI Crawler](#mdream-crawl), [Docker](#docker), [GitHub Actions](#github-actions-integration), [Vite](#vite-integration), & more.

## Benchmarks

### Speed

**NAPI (Node.js bindings):**

| Input Size | mdream (rust) | mdream (js) | html-to-markdown (NAPI) | Turndown (js) | node-html-markdown (js) |
|------------|---------------|-------------|-------------------------|---------------|-------------------------|
| **166 KB** | 🏆 **0.60ms** | 3.36ms *(5.6x)* | 4.00ms *(6.6x)* | 11.91ms *(19.7x)* | 15.35ms *(25.4x)* |
| **420 KB** | 🏆 **1.26ms** | 7.79ms *(6.2x)* | 8.21ms *(6.5x)* | 14.01ms *(11.1x)* | 17.23ms *(13.6x)* |
| **1.8 MB** | 🏆 **7.83ms** | 62.2ms *(7.9x)* | 85.1ms *(10.9x)* | 276.0ms *(35.2x)* | 💀 27,381ms *(3496x)* |

**Native Rust (no Node.js overhead):**

| Input Size | mdream | [htmd](https://crates.io/crates/htmd) | [html2md](https://crates.io/crates/html2md) | [html2md-rs](https://crates.io/crates/html2md-rs) | [mdka](https://crates.io/crates/mdka) | [html_to_markdown](https://crates.io/crates/html_to_markdown) |
|------------|--------|------|---------|-----------|------|-----------------|
| **166 KB** | 🏆 **0.29ms** | 1.63ms *(5.6x)* | 2.12ms *(7.3x)* | 💀 panicked | 2.22ms *(7.7x)* | 1.27ms *(4.4x)* |
| **420 KB** | 🏆 **0.32ms** | 2.65ms *(8.3x)* | 3.31ms *(10.3x)* | 1.39ms *(4.3x)* | 2.94ms *(9.2x)* | 1.88ms *(5.9x)* |
| **1.8 MB** | 🏆 **3.84ms** | 21.9ms *(5.7x)* | 💀 >30s | 27.9ms *(7.3x)* | 26.6ms *(6.9x)* | 14.1ms *(3.7x)* |

### Token Reduction

With `minimal: true` (which enables [`clean`](#clean-mode) by default), mdream produces significantly fewer tokens than competing libraries by isolating main content, filtering noise elements, and cleaning up link/image artifacts.

**Wikipedia (162 KB, 21,039 HTML tokens):**

| Library | Tokens | vs HTML |
|---------|--------|---------|
| mdream (`minimal: true`) | 🏆 **6,101** | **-71%** |
| mdream (default) | 7,673 | -64% |
| html-to-markdown (Rust) | 7,906 | -62% |
| node-html-markdown | 10,176 | -52% |
| Turndown | 10,435 | -50% |

**GitHub Docs (420 KB, 62,434 HTML tokens):**

| Library | Tokens | vs HTML |
|---------|--------|---------|
| mdream (`minimal: true`) | 🏆 **5,006** | **-92%** |
| mdream (default) | 8,256 | -87% |
| node-html-markdown | 8,758 | -86% |
| html-to-markdown (Rust) | 9,056 | -85% |
| Turndown | 43,983 | -30% |

**Wikipedia large (1.8 MB, 193,759 HTML tokens):**

| Library | Tokens | vs HTML |
|---------|--------|---------|
| mdream (`minimal: true`) | 🏆 **152,425** | **-21%** |
| mdream (default) | 163,885 | -15% |
| html-to-markdown (Rust) | 182,634 | -6% |
| Turndown | 195,978 | +1% |
| node-html-markdown | 283,136 | +46% |

See the [Benchmark methodology](./bench/README.md) for more details.

## What is Mdream?

A zero-dependency alternative to [Turndown](https://github.com/mixmark-io/turndown), [node-html-markdown](https://github.com/crosstype/node-html-markdown), and [html-to-markdown](https://github.com/JohannesKaufmann/html-to-markdown), built specifically for LLM input.

Traditional HTML to Markdown converters were not built for LLMs or humans. They tend to be slow and bloated and produce output that's poorly suited for LLMs token usage or for
human readability.

Other LLM specific convertors focus on supporting _all_ document formats, resulting in larger bundles and lower quality Markdown output.

Mdream core is a highly optimized primitive for producing Markdown from HTML that is optimized for LLMs.

Mdream ships several packages on top of this to generate LLM artifacts like `llms.txt`
for your own sites or generate LLM context for any project you're working with.

### Mdream Packages

Mdream is built to run anywhere for all projects and use cases and is available in the following packages:

| Package                                                                                                                                                                        | Description                                                                                                                                                   |
|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------|
| [<img src="https://github.com/harlan-zw/mdream/raw/refs/heads/main/.github/logo.png" width="16" height="16" style="vertical-align: middle;" alt="mdream logo">&nbsp;mdream](./packages/mdream/README.md)       | Rust NAPI engine + WASM for edge. Performance-first, declarative config. Includes CLI. |
| [<img src="https://api.iconify.design/material-symbols:language.svg" width="16" height="16" style="vertical-align: middle;" alt="browser icon">&nbsp;Browser CDN](#browser-cdn-usage)           | Use mdream directly in browsers via unpkg/jsDelivr without any build step                                |
| [<img src="https://github.com/harlan-zw/mdream/raw/refs/heads/main/.github/logo.png" width="16" height="16" style="vertical-align: middle;" alt="mdream logo">&nbsp;@mdream/js](./packages/js/README.md)       | Pure JS engine. Full hook access, zero native deps. Subpaths: `/plugins`, `/splitter`, `/parse`, `/llms-txt`, `/negotiate`. |
| [<img src="https://github.com/harlan-zw/mdream/raw/refs/heads/main/.github/logo.png" width="16" height="16" style="vertical-align: middle;" alt="mdream logo">&nbsp;@mdream/crawl](./packages/crawl/README.md) | Site-wide crawler to generate `llms.txt` artifacts from entire websites                                                                                       |
| [<img src="https://api.iconify.design/logos:docker-icon.svg" width="16" height="16" style="vertical-align: middle;" alt="docker icon">&nbsp;Docker](./DOCKER.md)                                     | Pre-built Docker image with Playwright Chrome for containerized website crawling                                                                              |
| [<img src="https://api.iconify.design/logos:vitejs.svg" width="16" height="16" style="vertical-align: middle;" alt="vite icon">&nbsp;@mdream/vite](./packages/vite/README.md)                          | Generate automatic `.md` for your own Vite sites                                                                                                              |
| [<img src="https://api.iconify.design/logos:nuxt-icon.svg" width="16" height="16" style="vertical-align: middle;" alt="nuxt icon">&nbsp;@mdream/nuxt](./packages/nuxt/README.md)                       | Generate automatic `.md` and `llms.txt` artifacts generation for Nuxt Sites                                                                                   |
| [<img src="https://api.iconify.design/mdi:github.svg" width="16" height="16" style="vertical-align: middle;" alt="github icon">&nbsp;@mdream/action](./packages/action/README.md)                | Generate `.md` and `llms.txt` artifacts from your static `.html` output                                                                                       |
| [<img src="https://api.iconify.design/logos:rust.svg" width="16" height="16" style="vertical-align: middle;" alt="rust icon">&nbsp;mdream (crate)](./crates/core/README.md)                | Native Rust crate with CLI. Zero dependencies, streaming support. Available on [crates.io](https://crates.io/crates/mdream)                                                                                       |

## Mdream Usage

### Installation

```bash
pnpm add mdream
```

> [!TIP]
> Generate an Agent Skill for this package using [skilld](https://github.com/harlan-zw/skilld):
> ```bash
> npx skilld add mdream
> ```

### Basic Usage

```ts
import { htmlToMarkdown } from 'mdream'

// Rust NAPI engine in Node.js, WASM in edge/browser runtimes
const markdown = htmlToMarkdown('<h1>Hello World</h1>')
console.log(markdown) // # Hello World
```

**Core Functions:**
- [htmlToMarkdown](./packages/mdream/README.md#api-usage) - Convert HTML to Markdown
- [streamHtmlToMarkdown](./packages/mdream/README.md#api-usage) - Stream HTML to Markdown

See the [API Usage](./packages/mdream/README.md#api-usage) section for complete details.

## Mdream Crawl

> Need something that works in the browser or an edge runtime? Use [Mdream](#mdream-usage).

The `@mdream/crawl` package crawls an entire site generating LLM artifacts using `mdream` for Markdown conversion.

- [llms.txt](https://llmstxt.org/): A consolidated text file optimized for LLM consumption.
- [llms-full.txt](https://llmstxt.org/): An extended format with comprehensive metadata and full content.
- Individual Markdown Files: Each crawled page is saved as a separate Markdown file in the `md/` directory.

### Usage

```sh
# Interactive
npx @mdream/crawl
# Simple
npx @mdream/crawl https://harlanzw.com
# Glob patterns
npx @mdream/crawl "https://nuxt.com/docs/getting-started/**"
# Get help
npx @mdream/crawl -h
```

### Examples

<details>
<summary><b>🤖 Analyze Websites with AI Tools</b></summary>

Feed website content directly to Claude or other AI tools:

```bash
# Analyze entire site with Claude
npx @mdream/crawl harlanzw.com
cat output/llms-full.txt | claude -p "summarize this website"

# Analyze specific documentation
npx @mdream/crawl "https://nuxt.com/docs/getting-started/**"
cat output/llms-full.txt | claude -p "explain key concepts"

# Analyze JavaScript/SPA sites (React, Vue, Angular)
npx -p playwright -p @mdream/crawl crawl https://spa-site.com --driver playwright
cat output/llms-full.txt | claude -p "what features does this app have"

# Convert single page
curl -s https://en.wikipedia.org/wiki/Markdown | npx mdream --origin https://en.wikipedia.org | claude -p "summarize"
```
</details>

<details>
<summary><b>🌐 Make Your Site AI-Discoverable</b></summary>

Generate llms.txt to help AI tools understand your site:

```bash
# Static sites
npx @mdream/crawl https://yoursite.com

# JavaScript/SPA sites (React, Vue, Angular)
npx -p playwright -p @mdream/crawl crawl https://spa-site.com --driver playwright
```

Outputs:
- `output/llms.txt` - Optimized for LLM consumption
- `output/llms-full.txt` - Complete content with metadata
- `output/md/` - Individual markdown files per page
</details>

<details>
<summary><b>🗄️ Build RAG Systems from Websites</b></summary>

Crawl websites and generate embeddings for vector databases:

```ts
import { crawlAndGenerate } from '@mdream/crawl'
import { embed } from 'ai'
import { withMinimalPreset } from 'mdream/preset/minimal'
import { htmlToMarkdownSplitChunks } from 'mdream/splitter'

const { createTransformersJS } = await import('@built-in-ai/transformers-js')
const embeddingModel = createTransformersJS().textEmbeddingModel('Xenova/bge-base-en-v1.5')

const embeddings = []

await crawlAndGenerate({
  urls: ['https://example.com'],
  onPage: async ({ url, html, title, origin }) => {
    const chunks = htmlToMarkdownSplitChunks(html, withMinimalPreset({
      chunkSize: 1000,
      chunkOverlap: 200,
      origin,
    }))

    for (const chunk of chunks) {
      const { embedding } = await embed({ model: embeddingModel, value: chunk.content })
      embeddings.push({ url, title, content: chunk.content, embedding })
    }
  },
})

// Save to vector database: await saveToVectorDB(embeddings)
```
</details>

<details>
<summary><b>✂️ Extract Specific Content from Pages</b></summary>

Pull headers, images, or other elements during conversion:

```ts
import { htmlToMarkdown } from 'mdream'
import { extractionPlugin } from 'mdream/plugins'

const headers = []
const images = []

htmlToMarkdown(html, {
  plugins: [
    extractionPlugin({
      'h1, h2, h3': el => headers.push(el.textContent),
      'img[src]': el => images.push({ src: el.attributes.src, alt: el.attributes.alt })
    })
  ]
})
```
</details>

<details>
<summary><b>⚡ Optimize Token Usage With Clean Mode</b></summary>

Use `clean: true` (enabled by default with `minimal: true`) to automatically reduce token costs:

```ts
import { htmlToMarkdown } from 'mdream'

// All clean features enabled
htmlToMarkdown(html, { clean: true })

// Or selective features
htmlToMarkdown(html, {
  clean: {
    emptyLinks: true, // Strip #, javascript: links
    emptyLinkText: true, // Drop [](url) links with no text
    emptyImages: true, // Strip ![](url) with no alt text
    redundantLinks: true, // [url](url) → url
    selfLinkHeadings: true, // ## [Title](#title) → ## Title
    fragments: true, // Strip broken #anchor links
    urls: true, // Strip utm_*, fbclid tracking params
  }
})
```
</details>

## Clean Mode

The `clean` option removes common HTML-to-markdown noise. It's enabled by default with `minimal: true` and can be used independently.

| Feature | Description |
|---------|-------------|
| `emptyLinks` | Strip links with `#` or `javascript:` hrefs |
| `emptyLinkText` | Drop links that produce no visible text (icon-only, SVG-only) |
| `emptyImages` | Strip images with no alt text (tracking pixels, spacers) |
| `redundantLinks` | `[https://x.com](https://x.com)` → `https://x.com` |
| `selfLinkHeadings` | `## [Title](#title)` → `## Title` |
| `fragments` | Strip `[text](#broken)` links with no matching heading |
| `urls` | Strip tracking query params (utm_*, fbclid, gclid, etc.) |

```ts
// minimal: true enables clean by default
htmlToMarkdown(html, { minimal: true })

// Disable clean with minimal
htmlToMarkdown(html, { minimal: true, clean: false })
```

## Stdin CLI Usage

Mdream is much more minimal than Mdream Crawl. It provides a CLI designed to work exclusively with Unix pipes,
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

## Docker

Run `@mdream/crawl` with Playwright Chrome pre-installed for website crawling in containerized environments.

```bash
# Quick start
docker run harlanzw/mdream:latest site.com/docs/**

# Interactive mode
docker run -it harlanzw/mdream:latest

# Using Playwright for JavaScript sites
docker run harlanzw/mdream:latest spa-site.com --driver playwright
```

**Available Images:**
- `harlanzw/mdream:latest` - Latest stable release
- `ghcr.io/harlan-zw/mdream:latest` - GitHub Container Registry

See [DOCKER.md](./DOCKER.md) for complete usage, configuration, and building instructions.

## GitHub Actions Integration

### Installation

```bash
pnpm add @mdream/action
```

See the [GitHub Actions README](./packages/action/README.md) for usage and configuration.

## Vite Integration

### Installation

```bash
pnpm install @mdream/vite
```

See the [Vite README](./packages/vite/README.md) for usage and configuration.

## Nuxt Integration

### Installation

```bash
pnpm add @mdream/nuxt
```

See the [Nuxt Module README](./packages/nuxt/README.md) for usage and configuration.

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

## Credits

- [ultrahtml](https://github.com/natemoo-re/ultrahtml): HTML parsing inspiration

## License

Licensed under the [MIT license](https://github.com/harlan-zw/mdream/blob/main/LICENSE.md).

