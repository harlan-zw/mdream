<h1>mdream</h1>

[![npm version](https://img.shields.io/npm/v/mdream?color=yellow)](https://npmjs.com/package/mdream)
[![npm downloads](https://img.shields.io/npm/dm/mdream?color=yellow)](https://npm.chart.dev/mdream)
[![license](https://img.shields.io/github/license/harlan-zw/mdream?color=yellow)](https://github.com/harlan-zw/mdream/blob/main/LICENSE.md)

> Convert any site to clean markdown & llms.txt. Boost your site's AI discoverability or generate LLM context for a project you're working with.

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

- 🧠 Custom built HTML to Markdown Convertor Optimized for LLMs (~50% fewer tokens)
- 🔍 Generates [Minimal](./packages/mdream/src/preset/minimal.ts) GitHub Flavored Markdown: Frontmatter, Nested & HTML markup support.
- ✂️ LangChain compatible [Markdown Text Splitter](#text-splitter) for single-pass chunking.
- 🚀 Ultra Fast: Stream 1.4MB of HTML to markdown in ~50ms.
- ⚡ Tiny: 6kB gzip, zero dependency core.
- ⚙️ Run anywhere: [CLI Crawler](#mdream-crawl), [Docker](#docker-usage), [GitHub Actions](#github-actions-integration), [Vite](#vite-integration), & more.
- 🔌 Extensible: [Plugin system](#plugin-system) for customizing and extending functionality.

## What is Mdream?

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
| [<img src="https://github.com/harlan-zw/mdream/raw/refs/heads/main/.github/logo.png" width="16" height="16" style="vertical-align: middle;">&nbsp;mdream](./packages/mdream/README.md)       | HTML to Markdown converter, use anywhere: browser, edge runtime, node, etc. Includes CLI for `stdin` conversion and package API. **Minimal: no dependencies** |
| [<img src="https://api.iconify.design/material-symbols:language.svg" width="16" height="16" style="vertical-align: middle;">&nbsp;Browser CDN](#browser-cdn-usage)           | Use mdream directly in browsers via unpkg/jsDelivr without any build step                                |
| [<img src="https://github.com/harlan-zw/mdream/raw/refs/heads/main/.github/logo.png" width="16" height="16" style="vertical-align: middle;">&nbsp;@mdream/crawl](./packages/crawl/README.md) | Site-wide crawler to generate `llms.txt` artifacts from entire websites                                                                                       |
| [<img src="https://api.iconify.design/logos:docker-icon.svg" width="16" height="16" style="vertical-align: middle;">&nbsp;Docker](./DOCKER.md)                                     | Pre-built Docker image with Playwright Chrome for containerized website crawling                                                                              |
| [<img src="https://api.iconify.design/logos:vitejs.svg" width="16" height="16" style="vertical-align: middle;">&nbsp;@mdream/vite](./packages/vite/README.md)                          | Generate automatic `.md` for your own Vite sites                                                                                                              |
| [<img src="https://api.iconify.design/logos:nuxt-icon.svg" width="16" height="16" style="vertical-align: middle;">&nbsp;@mdream/nuxt](./packages/nuxt/README.md)                       | Generate automatic `.md` and `llms.txt` artifacts generation for Nuxt Sites                                                                                   |
| [<img src="https://api.iconify.design/mdi:github.svg" width="16" height="16" style="vertical-align: middle;">&nbsp;@mdream/action](./packages/action/README.md)                | Generate `.md` and `llms.txt` artifacts from your static `.html` output                                                                                       |

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

**Using with Claude Code**

Mdream works seamlessly with Claude Code to analyze and understand websites:

```bash
# Crawl a website and analyze with Claude
npx @mdream/crawl harlanzw.com
cat output/llms-full.txt | claude -p "give me a one sentence summary of this website"

# Analyze specific documentation sections
npx @mdream/crawl "https://nuxt.com/docs/getting-started/**"
cat output/llms-full.txt | claude -p "explain the key concepts in this documentation"

# Extract specific information from a site
npx @mdream/crawl example.com/blog
cat output/llms.txt | claude -p "list all the blog post titles and their main topics"

# Convert and analyze a single page
curl -s https://en.wikipedia.org/wiki/Markdown | npx mdream --origin https://en.wikipedia.org | claude -p "summarize the history of Markdown"
```

**Crawl Using Playwright**

```bash
npx -p playwright -p @mdream/crawl crawl -u example.com --driver playwright
```

```bash
pnpm --package=playwright --package=@mdream/crawl dlx crawl example.com --driver playwright
```

**Exclude Specific Paths**

```bash
npx @mdream/crawl -u example.com --exclude "/admin/*" --exclude "/api/*"
```

**Large Site Crawling with Limits**
```bash
npx @mdream/crawl -u https://large-site.com \
  --max-pages 100 \
  --depth 2
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

## Mdream Usage

### Installation

```bash
pnpm add mdream
```

### Basic Usage

```ts
import { htmlToMarkdown } from 'mdream'

const markdown = htmlToMarkdown('<h1>Hello World</h1>')
console.log(markdown) // # Hello World
```

See the [Mdream Package README](./packages/mdream/README.md) for complete documentation on API usage, streaming, presets, and the plugin system.

## Text Splitter

Mdream includes a [LangChain](https://python.langchain.com/api_reference/text_splitters/markdown/langchain_text_splitters.markdown.ExperimentalMarkdownSyntaxTextSplitter.html) compatible Markdown splitter that runs efficiently in single pass.

This provides significant performance improvements over traditional multi-pass splitters and allows
you to integrate with your custom Mdream plugins.

```ts
import { htmlToMarkdownSplitChunks } from 'mdream/splitter'

const chunks = await htmlToMarkdownSplitChunks('<h1>Hello World</h1><p>This is a paragraph.</p>', {
  chunkSize: 1000,
  chunkOverlap: 200,
})
console.log(chunks) // Array of text chunks
```

See the [Text Splitter Documentation](./packages/mdream/docs/splitter.md) for complete usage and configuration.

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
