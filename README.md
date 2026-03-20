<h1>mdream</h1>

[![npm version](https://img.shields.io/npm/v/mdream?color=yellow)](https://npmjs.com/package/mdream)
[![npm downloads](https://img.shields.io/npm/dm/mdream?color=yellow)](https://npm.chart.dev/mdream)
[![license](https://img.shields.io/github/license/harlan-zw/mdream?color=yellow)](https://github.com/harlan-zw/mdream/blob/main/LICENSE.md)

> ☁️ The fastest HTML to markdown converter on GitHub. Optimized for LLMs and supports streaming.

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

- 🧠 #1 Token Optimizer: [Up to 2x fewer tokens](#benchmarks) than [Turndown](https://github.com/mixmark-io/turndown), node-html-markdown, and html-to-markdown. 70-99% fewer tokens than raw HTML.
- 🚀 #1 Fastest: [Fastest pure JS & native Rust](#benchmarks) converter. Up to 37x faster than Turndown (Rust NAPI vs JS), 4.6x, 5x faster than htmd (Rust vs Rust). Converts 1.8MB HTML in ~5.2ms (Rust).
- 🔍 Generates [Minimal](./packages/mdream/src/preset/minimal.ts) GitHub Flavored Markdown: Frontmatter, Nested & HTML markup support.
- 🌊 Streamable: Memory efficient streaming for large documents and real-time pipelines.
- ⚡ Tiny: 10kB gzip JS core, 60kB gzip with Rust WASM engine. Zero dependencies.
- ⚙️ Run anywhere: [CLI Crawler](#mdream-crawl), [Docker](#docker), [GitHub Actions](#github-actions-integration), [Vite](#vite-integration), & more.

## What is Mdream?

A zero-dependency, LLM-optimized HTML to Markdown converter. Faster and leaner than [Turndown](https://github.com/mixmark-io/turndown), [node-html-markdown](https://github.com/crosstype/node-html-markdown), and [html-to-markdown](https://github.com/JohannesKaufmann/html-to-markdown), with output tuned for token efficiency and readability.

On top of the core converter, Mdream ships packages to generate LLM artifacts like `llms.txt` for your own sites or produce LLM context for any project.

### Mdream Packages

Mdream is built to run anywhere for all projects and use cases and is available in the following packages:

| Package                                                                                                                                                                                                  | Description                                                                                                                                                   |
|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------|
| [<img src="https://github.com/harlan-zw/mdream/raw/refs/heads/main/.github/logo.png" width="16" height="16" style="vertical-align: middle;" alt="mdream logo">&nbsp;mdream](./packages/mdream/README.md) | Rust NAPI engine + WASM for edge. Performance-first, declarative config. Includes CLI. |
| [<img src="https://github.com/harlan-zw/mdream/raw/refs/heads/main/.github/logo.png" width="16" height="16" style="vertical-align: middle;" alt="mdream logo">&nbsp;@mdream/js](./packages/js/README.md) | Pure JS engine. Full hook access, zero native deps. Subpaths: `/plugins`, `/splitter`, `/parse`, `/llms-txt`, `/negotiate`. |
| [<img src="https://github.com/harlan-zw/mdream/raw/refs/heads/main/.github/logo.png" width="16" height="16" style="vertical-align: middle;" alt="mdream logo">@mdream/crawl](./packages/crawl/README.md) | Site-wide crawler to generate `llms.txt` artifacts from entire websites                                                                                       |
| [<img src="https://api.iconify.design/logos:docker-icon.svg" width="16" height="16" style="vertical-align: middle;" alt="docker icon">&nbsp;Docker](./DOCKER.md)                                         | Pre-built Docker image with Playwright Chrome for containerized website crawling                                                                              |
| [<img src="https://api.iconify.design/logos:vitejs.svg" width="16" height="16" style="vertical-align: middle;" alt="vite icon">&nbsp;@mdream/vite](./packages/vite/README.md)                            | Generate automatic `.md` for your own Vite sites                                                                                                              |
| [<img src="https://api.iconify.design/logos:nuxt-icon.svg" width="16" height="16" style="vertical-align: middle;" alt="nuxt icon">&nbsp;@mdream/nuxt](./packages/nuxt/README.md)                         | Generate automatic `.md` and `llms.txt` artifacts generation for Nuxt Sites                                                                                   |
| [<img src="https://api.iconify.design/mdi:github.svg" width="16" height="16" style="vertical-align: middle;" alt="github icon">&nbsp;@mdream/action](./packages/action/README.md)                        | Generate `.md` and `llms.txt` artifacts from your static `.html` output                                                                                       |
| [<img src="https://api.iconify.design/logos:rust.svg" width="16" height="16" style="vertical-align: middle;" alt="rust icon">&nbsp;mdream (crate)](./crates/core/README.md)                              | Native Rust crate with CLI. Zero dependencies, streaming support. Available on [crates.io](https://crates.io/crates/mdream)                                                                                       |
| [<img src="https://api.iconify.design/material-symbols:language.svg" width="16" height="16" style="vertical-align: middle;" alt="browser icon">&nbsp;Browser CDN](#browser-cdn-usage)                    | Use mdream directly in browsers via unpkg/jsDelivr without any build step                                |

### What can Mdream do?


<details>
<summary><b>📥 URL to Markdown</b></summary>

Fetches the [Markdown Wikipedia page](https://en.wikipedia.org/wiki/Markdown) and converts it to Markdown preserving the original links and images.

```bash
curl -s https://en.wikipedia.org/wiki/Markdown \
 | npx mdream@beta --origin https://en.wikipedia.org --preset minimal \
  | tee streaming.md
```

_Tip: The `--origin` flag will fix relative image and link paths_

Want to make it look nice? Use [glow](https://github.com/charmbracelet/glow).

```bash
curl -s https://en.wikipedia.org/wiki/Markdown \
 | npx mdream@beta --origin https://en.wikipedia.org --preset minimal \
   | glow
```

</details>

<details>
<summary><b>📄 Local HTML to Markdown</b></summary>

Converts a local HTML file to a Markdown file, using `tee` to write the output to a file and display it in the terminal.

```bash
cat index.html \
 | npx mdream@beta --preset minimal \
  | tee streaming.md
```

Want to make it look nice? Use [glow](https://github.com/charmbracelet/glow).

```bash
cat index.html \
 | npx mdream@beta --preset minimal \
  | glow
```

</details>

<details>
<summary><b>🧠 Feed Any Website to an LLM</b></summary>

Pipe web content straight into Claude, GPT, or any LLM CLI:

```bash
# Single page → Claude
curl -s https://react.dev/learn | npx mdream@beta --origin https://react.dev --preset minimal \
  | claude -p "explain the key concepts on this page"

# Crawl entire docs → summarize
npx @mdream/crawl@beta "https://nuxt.com/docs/getting-started/**"
cat output/llms-full.txt | claude -p "write a getting started guide from these docs"

# Compare two frameworks
diff <(curl -s https://vuejs.org/guide/introduction | npx mdream@beta --preset minimal) \
     <(curl -s https://react.dev/learn | npx mdream@beta --preset minimal) \
  | claude -p "compare these two frameworks based on their intro docs"

# JavaScript/SPA sites (React, Vue, Angular)
npx @mdream/crawl@beta https://spa-site.com --driver playwright
cat output/llms-full.txt | claude -p "what features does this app have"
```
</details>

<details>
<summary><b>🌐 Make Your Site AI-Discoverable</b></summary>

Generate llms.txt to help AI tools understand your site:

```bash
# Static sites
npx @mdream/crawl@beta https://yoursite.com

# JavaScript/SPA sites (React, Vue, Angular)
npx -p playwright -p @mdream/crawl@beta crawl https://spa-site.com --driver playwright
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
import { withMinimalPreset } from '@mdream/js/preset/minimal'
import { htmlToMarkdownSplitChunks } from '@mdream/js/splitter'
import { embed } from 'ai'

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

const headers = []
const images = []

htmlToMarkdown(html, {
  extraction: {
    'h1, h2, h3': el => headers.push(el.textContent),
    'img[src]': el => images.push({ src: el.attributes.src, alt: el.attributes.alt }),
  },
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


## Mdream Usage

### Installation

```bash
pnpm add mdream@beta
```

> [!TIP]
> Generate an Agent Skill for this package using [skilld](https://github.com/harlan-zw/skilld):
> ```bash
> npx skilld add mdream
> ```

### Bundler Compatibility

The `mdream` package uses native Node.js bindings (NAPI-RS) which cannot be statically bundled. If your bundler fails to resolve `mdream`, mark it as external:

**Next.js / Turbopack:**
```js
// next.config.js
const nextConfig = {
  serverExternalPackages: ['mdream'],
}
```

**Webpack / other bundlers:**
```js
externals: ['mdream']
```

> [!TIP]
> [`@mdream/js`](https://github.com/harlan-zw/mdream/tree/main/packages/js) has zero native dependencies and works with all bundlers without configuration.

> [!TIP]
> Using Vite? [`@mdream/vite`](https://github.com/harlan-zw/mdream/tree/main/packages/vite) handles this automatically.

### Basic Usage

```ts
import { htmlToMarkdown } from 'mdream'

// Rust NAPI engine in Node.js, WASM in edge/browser runtimes
const markdown = htmlToMarkdown('<h1>Hello World</h1>')
console.log(markdown) // # Hello World
```

```ts
import { streamHtmlToMarkdown } from 'mdream'

const response = await fetch('https://en.wikipedia.org/wiki/Markdown')
for await (const chunk of streamHtmlToMarkdown(response.body, {
  origin: 'https://en.wikipedia.org',
  minimal: true,
})) {
  process.stdout.write(chunk)
}
```

See the [mdream docs](./packages/mdream/README.md#api-usage) for complete details.

## Mdream Crawl

> Need something that works in the browser or an edge runtime? Use [Mdream](#mdream-usage).

The `@mdream/crawl` package crawls an entire site generating LLM artifacts using `mdream` for Markdown conversion.

- [llms.txt](https://llmstxt.org/): A consolidated text file optimized for LLM consumption.
- [llms-full.txt](https://llmstxt.org/): An extended format with comprehensive metadata and full content.
- Individual Markdown Files: Each crawled page is saved as a separate Markdown file in the `md/` directory.

### Usage

```sh
# Interactive
npx @mdream/crawl@beta
# Simple
npx @mdream/crawl@beta https://harlanzw.com
# Glob patterns
npx @mdream/crawl@beta "https://nuxt.com/docs/getting-started/**"
# Get help
npx @mdream/crawl@beta -h
```

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
pnpm add @mdream/action@beta
```

See the [GitHub Actions README](./packages/action/README.md) for usage and configuration.

## Vite Integration

### Installation

```bash
pnpm install @mdream/vite@beta
```

See the [Vite README](./packages/vite/README.md) for usage and configuration.

## Nuxt Integration

### Installation

```bash
pnpm add @mdream/nuxt@beta
```

See the [Nuxt Module README](./packages/nuxt/README.md) for usage and configuration.

## Browser CDN Usage

Use mdream directly via CDN with no build step. Call `init()` once to load the WASM binary, then use `htmlToMarkdown()` synchronously:

```html
<script src="https://unpkg.com/mdream/dist/iife.js"></script>
<script>
  await window.mdream.init()
  const markdown = window.mdream.htmlToMarkdown('<h1>Hello</h1><p>World</p>')
  console.log(markdown) // # Hello\n\nWorld
</script>
```

**CDN Options:**
- **unpkg**: `https://unpkg.com/mdream/dist/iife.js`
- **jsDelivr**: `https://cdn.jsdelivr.net/npm/mdream/dist/iife.js`

## Benchmarks

### JavaScript (Node.js)

Pure JS comparison. mdream uses no plugins, Turndown uses GFM plugin for equivalent table/strikethrough support.

| Input | mdream | Turndown | node-html-markdown | rehype-remark |
|-------|--------|----------|---------------------|---------------|
| 166 KB | **3.26ms** | 11.26ms *(3.5x)* | 14.31ms *(4.4x)* | 35.19ms *(10.8x)* |
| 420 KB | **6.38ms** | 13.63ms *(2.1x)* | 17.11ms *(2.7x)* | 62.10ms *(9.7x)* |
| 1.8 MB | **57.2ms** | 264.3ms *(4.6x)* | 26,072ms *(456x)* | 826.7ms *(14.5x)* |

### Rust (native, release + LTO)

All crates compiled with `opt-level=3`, LTO, and single codegen unit.

| Input | mdream | htmd | html2md | html2md-rs | mdka | html_to_markdown |
|-------|--------|------|---------|------------|------|------------------|
| 166 KB | **0.34ms** | 2.13ms *(6.3x)* | 2.71ms *(8.0x)* | panicked | 2.65ms *(7.8x)* | 1.72ms *(5.1x)* |
| 420 KB | **0.41ms** | 3.50ms *(8.6x)* | 4.25ms *(10.4x)* | 1.54ms *(3.8x)* | 3.56ms *(8.7x)* | 2.72ms *(6.7x)* |
| 1.8 MB | **5.20ms** | 34.4ms *(6.6x)* | >30s | 35.5ms *(6.8x)* | 37.6ms *(7.2x)* | 28.5ms *(5.5x)* |

### Rust NAPI (Node.js bindings)

For Node.js apps that need native speed. Includes N-API overhead.

| Input | mdream (rust) | html-to-markdown (rust) |
|-------|---------------|-------------------------|
| 166 KB | **0.52ms** | 3.94ms *(7.6x)* |
| 420 KB | **0.76ms** | 7.48ms *(9.8x)* |
| 1.8 MB | **7.14ms** | 82.9ms *(11.6x)* |

### CLI (cross-language, includes process startup)

End-to-end `cat file | tool > /dev/null` via [hyperfine](https://github.com/sharkdp/hyperfine). Includes process startup overhead (~20ms for Node.js, ~1ms for Go/Rust).

| Input | mdream (Rust) | mdream (Node.js) | html2markdown (Go) |
|-------|---------------|-------------------|---------------------|
| 166 KB | **1.4ms** | 26.9ms | 4.9ms |
| 420 KB | **2.1ms** | 24.3ms | 5.6ms |
| 1.8 MB | **10.1ms** | 34.8ms | 75.2ms *(7.5x)* |

mdream's Rust CLI is 2.6-7.5x faster than Go [html2markdown](https://github.com/JohannesKaufmann/html-to-markdown). On the 1.8MB file, even the Node.js CLI (with ~20ms startup tax) beats Go by 2.2x. For raw conversion speed without startup overhead, see the JS and Rust tables above.

### Streaming

mdream is the only JavaScript HTML-to-markdown converter with streaming support. In the Go ecosystem, [JohannesKaufmann/html-to-markdown](https://github.com/JohannesKaufmann/html-to-markdown) supports streaming via `io.Reader`. No other JS, Rust, or Python converter supports streaming HTML input.

### Token Efficiency

With `minimal: true`, mdream produces up to **92% fewer tokens** than raw HTML and up to **2x fewer tokens** than competing libraries.

| Page (HTML tokens) | mdream minimal | Turndown | node-html-markdown |
|---------------------|----------------|----------|---------------------|
| Wikipedia (21K) | **6,101** (-71%) | 10,435 (-50%) | 10,176 (-52%) |
| GitHub Docs (62K) | **5,006** (-92%) | 43,983 (-30%) | 8,758 (-86%) |
| Wikipedia XL (194K) | **152,425** (-21%) | 195,978 (+1%) | 283,136 (+46%) |

Benchmarks run on real-world HTML using [Vitest bench](https://vitest.dev/guide/features.html#benchmarking). See [full methodology and reproduction steps](./bench/README.md).

## Credits

- [ultrahtml](https://github.com/natemoo-re/ultrahtml): HTML parsing inspiration

## License

Licensed under the [MIT license](https://github.com/harlan-zw/mdream/blob/main/LICENSE.md).

