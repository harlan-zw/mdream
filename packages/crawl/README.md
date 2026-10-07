# @mdream/crawl

Multi-page website crawler that generates [llms.txt](https://llmstxt.org/) files. Follows internal links and converts HTML to Markdown using [mdream](../mdream).

Upgrading from v1? Read [Migrating from v1](#migrating-from-v1).

## Setup

```bash
npm install @mdream/crawl@beta
```

After a global install (`npm install -g @mdream/crawl@beta`), run the `mdream-crawl` command. With `npx`, use the package name: `npx @mdream/crawl@beta`.

For JavaScript-heavy sites that require browser rendering, install the optional Playwright dependencies:

```bash
npm install crawlee playwright
npx playwright install chromium
```

## CLI Usage

### Interactive Mode

Run without arguments to start the interactive prompt-based interface:

```bash
npx @mdream/crawl@beta
```

### Direct Mode

Pass arguments directly to skip interactive prompts:

```bash
npx @mdream/crawl@beta -u https://docs.example.com
```

### CLI Options

Most flags set the [option](#crawloptions) with the same name in camelCase. For example, `--max-pages` sets `maxPages`.

| Flag | Alias | Description | Default |
|------|-------|-------------|---------|
| `--url <url>` | `-u` | URL to crawl. Accepts glob patterns. Repeatable. You can also pass URLs without a flag | Required |
| `--output <dir>` | `-o` | Output directory | `output` |
| `--depth <number>` | `-d` | Link depth from 0 to 10. See [Depth](#depth) | `3` |
| `--single-page` | | Same as `--depth 0`. It takes precedence over `--depth` | |
| `--driver <type>` | | Crawler driver: `http` or `playwright` | `http` |
| `--artifacts <list>` | | Comma-separated list of `llms.txt`, `llms-full.txt`, `markdown` | all three |
| `--origin <url>` | | Origin for relative links in page Markdown | the origin of each page |
| `--site-name <name>` | | Site name in llms.txt | the home page title |
| `--description <text>` | | Site description in llms.txt | the home page description |
| `--max-pages <number>` | | Maximum number of pages to fetch | no limit |
| `--crawl-delay <seconds>` | | Delay between requests in seconds | the `robots.txt` `Crawl-delay`, or none |
| `--exclude <pattern>` | | Skip URLs that match a glob pattern. Repeatable | none |
| `--skip-sitemap` | | Skip `sitemap.xml` and `robots.txt` discovery | `false` |
| `--sitemap <url>` | | Use this sitemap instead of auto-discovery. Repeatable for multi-part sitemaps | auto-discovered |
| `--allow-subdomains` | | Crawl other subdomains of the same root domain | `false` |
| `--keep-boilerplate` | | Keep repeated navigation and footers in page Markdown. Sets `stripBoilerplate: false` | `false` |
| `--boilerplate-threshold <n>` | | Fraction of pages that a block must appear in to count as boilerplate. Greater than 0 and at most 1 | `0.5` |
| `--verbose` | `-v` | Log details for each failed URL | `false` |
| `--quiet` | `-q`, `--silent` | Drop all logs. Use it to keep stdout clean for JSON-RPC or MCP | `false` |
| `--help` | `-h` | Show the help message | |
| `--version` | | Show the version number | |

A flag can also take its value as `--flag=value`. If a flag is unknown, the CLI exits with code 1. A long flag needs two dashes: `-url` is an error.

Flags override values from the [config file](#config-file). Config values override the defaults.

### CLI Examples

```bash
# Basic crawl with specific artifacts
npx @mdream/crawl@beta -u harlanzw.com --artifacts "llms.txt,markdown"

# Shallow crawl (depth 2) with only llms-full.txt output
npx @mdream/crawl@beta --url https://docs.example.com --depth 2 --artifacts "llms-full.txt"

# Exclude admin and API routes
npx @mdream/crawl@beta -u example.com --exclude "*/admin/*" --exclude "*/api/*"

# Single page mode (no link following)
npx @mdream/crawl@beta -u example.com/pricing --single-page

# Use Playwright for JavaScript-heavy sites
npx @mdream/crawl@beta -u example.com --driver playwright

# Skip sitemap discovery with verbose output
npx @mdream/crawl@beta -u example.com --skip-sitemap --verbose

# Crawl across subdomains (docs.example.com, blog.example.com, etc.)
npx @mdream/crawl@beta -u example.com --allow-subdomains

# Override site metadata
npx @mdream/crawl@beta -u example.com --site-name "My Company" --description "Company documentation"
```

## Glob Patterns

Use glob patterns to select URLs.
If you provide a pattern, the crawler uses sitemap discovery to find matching URLs.

```bash
# Crawl only the /docs/ section
npx @mdream/crawl@beta -u "docs.example.com/docs/**"

# Crawl pages matching a prefix
npx @mdream/crawl@beta -u "example.com/blog/2024*"
```

Patterns are matched against the URL pathname using [picomatch](https://github.com/micromatch/picomatch) syntax. A trailing single `*` (e.g. `/fieldtypes*`) automatically expands to match both the path itself and all subdirectories.

## Programmatic API

### `crawlAndGenerate(options, onProgress?)`

The main entry point for programmatic use. Returns a `Promise<CrawlResult[]>`.

```typescript
import { crawlAndGenerate } from '@mdream/crawl'

const results = await crawlAndGenerate({
  urls: ['https://docs.example.com'],
  output: './output',
})
```

### `CrawlOptions`

`crawlAndGenerate`, the [config file](#config-file), and the [CLI](#cli-options) use the same options and the same defaults. Only `urls` is required.

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `urls` | `string[]` | Required | Starting URLs. Glob patterns limit the crawl |
| `output` | `string` | `'output'` | Output directory, relative to the working directory |
| `depth` | `number` | `3` | Link depth from 0 to 10. See [Depth](#depth) |
| `maxPages` | `number` | no limit | Maximum number of pages to fetch |
| `artifacts` | `('llms.txt' \| 'llms-full.txt' \| 'markdown')[]` | all three | Files to write. `[]` writes no files, for example when only [hooks](#hooks) consume the pages |
| `driver` | `'http' \| 'playwright'` | `'http'` | Crawler driver |
| `sitemap` | `string \| string[]` | auto-discovered | Sitemap URLs to use instead of auto-discovery. All parts are loaded and merged. Ignored when `skipSitemap` is set |
| `skipSitemap` | `boolean` | `false` | Skip `sitemap.xml` and `robots.txt` discovery |
| `siteName` | `string` | the home page title | Site name in `llms.txt` |
| `description` | `string` | the home page description | Site description in `llms.txt` |
| `origin` | `string` | the origin of each page | Origin for relative links in page Markdown. The page path stays the same |
| `exclude` | `string[]` | `[]` | Glob patterns for URLs to skip |
| `crawlDelay` | `number` | the `robots.txt` `Crawl-delay` | Delay between requests in seconds |
| `allowSubdomains` | `boolean` | `false` | Crawl other subdomains of the same root domain, for example `docs.example.com` and `blog.example.com`. Output paths start with the hostname, so files do not collide |
| `stripBoilerplate` | `boolean` | `true` | Remove repeated navigation and footers from page Markdown and `llms-full.txt`. Needs at least 3 pages. Does not run at depth 0 |
| `boilerplateThreshold` | `number` | `0.5` | Fraction of pages that a block must appear in to count as boilerplate. Greater than 0 and at most 1 |
| `useChrome` | `boolean` | `false` | Use the system Chrome with the Playwright driver. The CLI turns it on when it finds Chrome, unless you set it to `false` |
| `verbose` | `boolean` | `false` | Log details for each failed URL |
| `silent` | `boolean` | `false` | Drop all diagnostic and progress logs. A `logger` takes precedence |
| `logger` | `CrawlLogger` | `@clack/prompts` on stdout | Sink for diagnostic and progress logs, for example one that writes to stderr |
| `hooks` | `Partial<CrawlHooks>` | | Functions for each stage of the crawl. See [Hooks](#hooks) |
| `globPatterns` | `ParsedUrlPattern[]` | parsed from `urls` | Parsed URL patterns that replace the patterns from `urls`. Advanced |

`crawlAndGenerate` checks the options before it sends a request. An unknown key or an invalid value throws a `TypeError`. A removed v1 key, such as `maxDepth`, gives an error that names its replacement.

### Depth

`depth` sets how far the crawler follows links from the starting URLs.

- `0`: The crawler processes only the given URLs. It does not read `robots.txt` or the sitemap, and it does not follow links.
- `1` or more: Unless `skipSitemap` is set, the crawler reads `robots.txt` and the sitemap first. If the sitemap gives URLs, the crawler fetches those URLs and does not follow links. If not, the crawler follows links up to `depth` hops from the starting URLs.

The maximum is 10. Use `maxPages` to limit the total number of pages.

### `CrawlResult`

```typescript
interface CrawlResult {
  url: string
  title: string
  content: string
  filePath?: string // Set when artifacts include 'markdown'
  timestamp: number // Unix timestamp of processing time
  success: boolean
  error?: string // Set when success is false
  metadata?: PageMetadata
  depth?: number // Link-following depth at which this page was found
}

interface PageMetadata {
  title: string
  description?: string
  keywords?: string
  author?: string
  links: string[] // Internal links discovered on the page
}
```

### `PageData`

The shape passed to the `crawl:page` hook:

```typescript
interface PageData {
  url: string
  html: string // Raw HTML (empty string if content was already markdown)
  title: string
  metadata: PageMetadata
  origin: string
}
```

### Progress Callback

The optional second argument to `crawlAndGenerate` receives progress updates:

```typescript
await crawlAndGenerate(options, (progress) => {
  // progress.sitemap.status: 'discovering' | 'processing' | 'completed'
  // progress.sitemap.found: number of sitemap URLs found
  // progress.sitemap.processed: number of URLs after filtering

  // progress.crawling.status: 'starting' | 'processing' | 'completed'
  // progress.crawling.total: total URLs to process
  // progress.crawling.processed: pages completed so far
  // progress.crawling.failed: pages that errored
  // progress.crawling.currentUrl: URL currently being fetched
  // progress.crawling.latency: { total, min, max, count } in ms

  // progress.generation.status: 'idle' | 'generating' | 'completed'
  // progress.generation.current: description of current generation step
})
```

### Examples

#### Custom page processing with `crawl:page`

```typescript
import { crawlAndGenerate } from '@mdream/crawl'

const pages = []

await crawlAndGenerate({
  urls: ['https://docs.example.com'],
  artifacts: [],
  hooks: {
    'crawl:page': (page) => {
      pages.push({
        url: page.url,
        title: page.title,
        description: page.metadata.description,
      })
    },
  },
})

console.log(`Discovered ${pages.length} pages`)
```

#### Glob filtering with exclusions

```typescript
import { crawlAndGenerate } from '@mdream/crawl'

await crawlAndGenerate({
  urls: ['https://example.com/docs/**'],
  output: './docs-output',
  exclude: ['/docs/deprecated/*', '/docs/internal/*'],
  depth: 2,
})
```

#### Crawling across subdomains

```typescript
await crawlAndGenerate({
  urls: ['https://example.com'],
  allowSubdomains: true, // Will also crawl docs.example.com, blog.example.com, etc.
  depth: 2,
})
```

#### Single-page mode

Set `depth: 0` to process only the given URLs, with no discovery and no link following:

```typescript
await crawlAndGenerate({
  urls: ['https://example.com/pricing', 'https://example.com/about'],
  depth: 0,
})
```

## Config File

To set options and register hooks, create `mdream.config.ts` where you run the CLI.
The file can also use `.js` or `.mjs`.
The CLI loads it with [c12](https://github.com/unjs/c12) in direct and interactive modes.

```typescript
import { defineConfig } from '@mdream/crawl'

export default defineConfig({
  exclude: ['*/admin/*', '*/internal/*'],
  depth: 2,
  maxPages: 500,
  artifacts: ['llms.txt', 'markdown'],
  hooks: {
    'crawl:page': (page) => {
      // Strip branding from all page titles
      page.title = page.title.replace(/ \| My Brand$/, '')
    },
  },
})
```

The config file accepts every [`CrawlOptions`](#crawloptions) key. Each key is optional.
If you set `urls`, you can run the CLI without a URL argument.
Interactive mode uses the config values as its initial answers.

The CLI resolves each option in this order:

1. A CLI flag, or an answer in interactive mode
2. The config file
3. The default

`exclude` is the exception: the CLI adds its patterns to the config patterns. An unknown key in the config file stops the CLI with an error.

## Hooks

Five hooks let you change data during the crawl.
Each hook receives a mutable object.
Change its properties to transform the output.

### `crawl:url`

Called before fetching a URL. Set `ctx.skip = true` to skip it entirely (saves the network request).

```typescript
defineConfig({
  hooks: {
    'crawl:url': (ctx) => {
      // Skip large asset pages
      if (ctx.url.includes('/assets/') || ctx.url.includes('/downloads/'))
        ctx.skip = true
    },
  },
})
```

### `crawl:html`

Runs after fetching, before HTML-to-Markdown conversion.
Change `ctx.html` to remove elements or add content before conversion.
The hook does not run if the fetched content is already Markdown.

```typescript
defineConfig({
  hooks: {
    'crawl:html': (ctx) => {
      // ctx.url, ctx.html, ctx.origin
      ctx.html = ctx.html.replace(/<header[\s\S]*?<\/header>/, '')
    },
  },
})
```

### `crawl:page`

Called after HTML-to-Markdown conversion, before storage. Mutate `page.title` or other fields. This hook replaces the v1 `onPage` option.

```typescript
defineConfig({
  hooks: {
    'crawl:page': (page) => {
      // page.url, page.html, page.title, page.metadata, page.origin
      page.title = page.title.replace(/ - Docs$/, '')
    },
  },
})
```

### `crawl:content`

Called before markdown is written to disk. Transform the final output content or change the file path.

```typescript
defineConfig({
  hooks: {
    'crawl:content': (ctx) => {
      // ctx.url, ctx.title, ctx.content, ctx.filePath
      ctx.content = ctx.content.replace(/CONFIDENTIAL/g, '[REDACTED]')
      ctx.filePath = ctx.filePath.replace('.md', '.mdx')
    },
  },
})
```

### `crawl:done`

Called after all pages are crawled, before `llms.txt` generation. Filter or reorder results.

```typescript
defineConfig({
  hooks: {
    'crawl:done': (ctx) => {
      // Remove short pages from the final output
      const filtered = ctx.results.filter(r => r.content.length > 100)
      ctx.results.length = 0
      ctx.results.push(...filtered)
    },
  },
})
```

### Programmatic Hooks

Hooks can also be passed directly to `crawlAndGenerate`:

```typescript
import { crawlAndGenerate } from '@mdream/crawl'

await crawlAndGenerate({
  urls: ['https://example.com'],
  output: './output',
  hooks: {
    'crawl:page': (page) => {
      page.title = page.title.replace(/ \| Brand$/, '')
    },
    'crawl:done': (ctx) => {
      ctx.results.sort((a, b) => a.url.localeCompare(b.url))
    },
  },
})
```

## Crawl Drivers

### HTTP Driver (default)

Uses [`ofetch`](https://github.com/unjs/ofetch) for page fetching with up to 20 concurrent requests.

- Automatic retry (2 retries with 500ms delay)
- 10 second request timeout
- Respects `Retry-After` headers on 429 responses (automatically adjusts crawl delay)
- Detects `text/markdown` content types and skips HTML-to-Markdown conversion

### Playwright Driver

For sites that require a browser to render content. Requires `crawlee` and `playwright` as peer dependencies (see [Setup](#setup)).

```bash
npx @mdream/crawl@beta -u example.com --driver playwright
```

```typescript
await crawlAndGenerate({
  urls: ['https://spa-app.example.com'],
  output: './output',
  driver: 'playwright',
})
```

Waits for `networkidle` before extracting content. Automatically detects and uses system Chrome when available, falling back to Playwright's bundled browser.

## Sitemap and Robots.txt Discovery

By default, the crawler performs sitemap discovery before crawling:

1. Fetches `robots.txt` to find `Sitemap:` directives and `Crawl-delay` values
2. Loads sitemaps referenced in `robots.txt` (authoritative, tried first)
3. Falls back to `/sitemap.xml`
4. Tries common alternatives: `/sitemap_index.xml`, `/sitemaps.xml`, `/sitemap-index.xml`
5. Supports sitemap index files (recursively loads child sitemaps, with cycle protection)
6. Filters discovered URLs against glob patterns and exclusion rules

The first candidate that yields matching URLs wins, so a `robots.txt` sitemap is never overwritten by a well-known fallback. `<loc>` values are CDATA-unwrapped and XML-entity-decoded (`&amp;` → `&`).

The home page is always included for metadata extraction (site name, description).

Disable with `--skip-sitemap` or `skipSitemap: true`.

### Overriding the sitemap location

If a site uses a custom sitemap URL or several sitemap files, pass their locations explicitly:

```bash
# Single non-standard location
npx @mdream/crawl@beta -u example.com --sitemap https://example.com/custom/sitemap.xml

# Multiple parts (repeatable), all loaded and merged
npx @mdream/crawl@beta -u example.com \
  --sitemap https://example.com/sitemap-posts.xml \
  --sitemap https://example.com/sitemap-pages.xml
```

Or in `mdream.config.ts`:

```ts
import { defineConfig } from '@mdream/crawl'

export default defineConfig({
  sitemap: [
    'https://example.com/sitemap-posts.xml',
    'https://example.com/sitemap-pages.xml',
  ],
})
```

An explicit sitemap replaces auto-discovery entirely (`robots.txt` is still read for `Crawl-delay`).

## Artifacts

Choose the files with the `artifacts` option or the `--artifacts` flag. By default, the crawler writes all three.

### `markdown`

One `.md` file per crawled page, written to the output directory preserving the URL path structure. For example, `https://example.com/docs/getting-started` becomes `output/docs/getting-started.md`.

### `llms.txt`

A site overview file following the [llms.txt specification](https://llmstxt.org/), listing all crawled pages with titles and links to their markdown files.

```markdown
# example.com

## Pages

- [Example Domain](index.md): https://example.com/
- [About Us](about.md): https://example.com/about
```

### `llms-full.txt`

Same structure as `llms.txt` but includes the full markdown content of every page inline.

## Migrating from v1

These docs describe the code in this repository, including changes merged after `2.0.0-beta.1`.
If you use a published beta, read the README at its release tag.

In v2, `crawlAndGenerate`, the config file, and the CLI accept the same options and defaults.
The library uses the names of the CLI flags.

### Renamed options

| v1 | v2 |
|----|----|
| `outputDir` | `output`. It is optional now, and the default is `'output'` |
| `maxRequestsPerCrawl` | `maxPages` |
| `maxDepth` and `followLinks` | `depth`. See [Depth](#depth) |
| `sitemapUrls` | `sitemap`. It also accepts one string |
| `generateLlmsTxt`, `generateLlmsFullTxt`, `generateIndividualMd` | `artifacts: ['llms.txt', 'llms-full.txt', 'markdown']` |
| `siteNameOverride` | `siteName` |
| `descriptionOverride` | `description` |
| `onPage: fn` | `hooks: { 'crawl:page': fn }` |
| `chunkSize` | Remove it. It had no effect |
| `maxDepth` in `mdream.config` | `depth` |
| `MdreamCrawlConfig` type | `Partial<CrawlOptions>` |
| `crawl` command after a global install | `mdream-crawl` |

```diff
  await crawlAndGenerate({
    urls: ['https://example.com'],
-   outputDir: './output',
-   maxRequestsPerCrawl: 100,
-   followLinks: true,
-   maxDepth: 2,
-   generateLlmsFullTxt: true,
-   onPage: page => console.log(page.url),
+   output: './output',
+   maxPages: 100,
+   depth: 2,
+   artifacts: ['llms.txt', 'llms-full.txt', 'markdown'],
+   hooks: { 'crawl:page': page => console.log(page.url) },
  })
```

A v1 key now throws a `TypeError` that names its replacement. A key with the value `undefined` is ignored.
The library also checks values the same way as the CLI. For example, `depth` must be an integer from 0 to 10.

### New library defaults

The library defaults are now the CLI defaults:

- `depth` is `3`, so the crawler follows links when the sitemap gives no URLs. By default, the v1 library did not follow links.
- `artifacts` includes `llms-full.txt`. By default, the v1 library did not write it. To keep the v1 output, set `artifacts: ['llms.txt', 'markdown']`.
- `output` is `'output'`. In v1, `outputDir` was required.

v1 with `followLinks: false` used the sitemap and did not follow links. v2 has no exact match. Use `depth: 0` to process only the given URLs, or `depth: 1` to follow links one hop when there is no sitemap.

For your first v2 crawl, process only the supplied URLs and write to a separate directory:

```ts
import { crawlAndGenerate } from '@mdream/crawl'

await crawlAndGenerate({
  urls: ['https://example.com'],
  output: './output-v2',
  depth: 0,
  maxPages: 100,
  artifacts: ['llms.txt', 'markdown'],
})
```

Review the generated files before replacing the previous artifacts.
To follow links, increase `depth`.
This example skips sitemap discovery.

### CLI changes

- Config values for `maxPages`, `artifacts`, `driver`, and `depth` now apply. In v1, the CLI ignored them.
- Interactive mode loads the config file and its hooks.
- An unknown flag or a single-dash long flag, such as `-url`, stops the CLI with exit code 1.
- `--crawl-delay` accepts decimal values, such as `0.5`.
