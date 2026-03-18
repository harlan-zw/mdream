# @mdream/crawl

Multi-page website crawler that generates [llms.txt](https://llmstxt.org/) files. Follows internal links and converts HTML to Markdown using [mdream](../mdream).

## Setup

```bash
npm install @mdream/crawl
```

For JavaScript-heavy sites that require browser rendering, install the optional Playwright dependencies:

```bash
npm install crawlee playwright
```

## CLI Usage

### Interactive Mode

Run without arguments to start the interactive prompt-based interface:

```bash
npx @mdream/crawl
```

### Direct Mode

Pass arguments directly to skip interactive prompts:

```bash
npx @mdream/crawl -u https://docs.example.com
```

### CLI Options

| Flag | Alias | Description | Default |
|------|-------|-------------|---------|
| `--url <url>` | `-u` | Website URL to crawl (supports glob patterns) | Required |
| `--output <dir>` | `-o` | Output directory | `output` |
| `--depth <number>` | `-d` | Crawl depth (0 for single page, max 10) | `3` |
| `--single-page` | | Only process the given URL(s), no crawling. Alias for `--depth 0` | |
| `--driver <type>` | | Crawler driver: `http` or `playwright` | `http` |
| `--artifacts <list>` | | Comma-separated output formats: `llms.txt`, `llms-full.txt`, `markdown` | all three |
| `--origin <url>` | | Origin URL for resolving relative paths (overrides auto-detection) | auto-detected |
| `--site-name <name>` | | Override the auto-extracted site name used in llms.txt | auto-extracted |
| `--description <desc>` | | Override the auto-extracted site description used in llms.txt | auto-extracted |
| `--max-pages <number>` | | Maximum pages to crawl | unlimited |
| `--crawl-delay <seconds>` | | Delay between requests in seconds | from `robots.txt` or none |
| `--exclude <pattern>` | | Exclude URLs matching glob patterns (repeatable) | none |
| `--skip-sitemap` | | Skip `sitemap.xml` and `robots.txt` discovery | `false` |
| `--verbose` | `-v` | Enable verbose logging | `false` |
| `--help` | `-h` | Show help message | |
| `--version` | | Show version number | |

### CLI Examples

```bash
# Basic crawl with specific artifacts
npx @mdream/crawl -u harlanzw.com --artifacts "llms.txt,markdown"

# Shallow crawl (depth 2) with only llms-full.txt output
npx @mdream/crawl --url https://docs.example.com --depth 2 --artifacts "llms-full.txt"

# Exclude admin and API routes
npx @mdream/crawl -u example.com --exclude "*/admin/*" --exclude "*/api/*"

# Single page mode (no link following)
npx @mdream/crawl -u example.com/pricing --single-page

# Use Playwright for JavaScript-heavy sites
npx @mdream/crawl -u example.com --driver playwright

# Skip sitemap discovery with verbose output
npx @mdream/crawl -u example.com --skip-sitemap --verbose

# Override site metadata
npx @mdream/crawl -u example.com --site-name "My Company" --description "Company documentation"
```

## Glob Patterns

URLs support glob patterns for targeted crawling. When a glob pattern is provided, the crawler uses sitemap discovery to find all matching URLs.

```bash
# Crawl only the /docs/ section
npx @mdream/crawl -u "docs.example.com/docs/**"

# Crawl pages matching a prefix
npx @mdream/crawl -u "example.com/blog/2024*"
```

Patterns are matched against the URL pathname using [picomatch](https://github.com/micromatch/picomatch) syntax. A trailing single `*` (e.g. `/fieldtypes*`) automatically expands to match both the path itself and all subdirectories.

## Programmatic API

### `crawlAndGenerate(options, onProgress?)`

The main entry point for programmatic use. Returns a `Promise<CrawlResult[]>`.

```typescript
import { crawlAndGenerate } from '@mdream/crawl'

const results = await crawlAndGenerate({
  urls: ['https://docs.example.com'],
  outputDir: './output',
})
```

### `CrawlOptions`

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `urls` | `string[]` | Required | Starting URLs for crawling |
| `outputDir` | `string` | Required | Directory to write output files |
| `driver` | `'http' \| 'playwright'` | `'http'` | Crawler driver to use |
| `maxRequestsPerCrawl` | `number` | `Number.MAX_SAFE_INTEGER` | Maximum total pages to crawl |
| `followLinks` | `boolean` | `false` | Whether to follow internal links discovered on pages |
| `maxDepth` | `number` | `1` | Maximum link-following depth. `0` enables single-page mode |
| `generateLlmsTxt` | `boolean` | `true` | Generate an `llms.txt` file |
| `generateLlmsFullTxt` | `boolean` | `false` | Generate an `llms-full.txt` file with full page content |
| `generateIndividualMd` | `boolean` | `true` | Write individual `.md` files for each page |
| `origin` | `string` | auto-detected | Origin URL for resolving relative paths in HTML |
| `siteNameOverride` | `string` | auto-extracted | Override the site name in the generated `llms.txt` |
| `descriptionOverride` | `string` | auto-extracted | Override the site description in the generated `llms.txt` |
| `globPatterns` | `ParsedUrlPattern[]` | `[]` | Pre-parsed URL glob patterns (advanced usage) |
| `exclude` | `string[]` | `[]` | Glob patterns for URLs to exclude |
| `crawlDelay` | `number` | from `robots.txt` | Delay between requests in seconds |
| `skipSitemap` | `boolean` | `false` | Skip `sitemap.xml` and `robots.txt` discovery |
| `useChrome` | `boolean` | `false` | Use system Chrome instead of Playwright's bundled browser (Playwright driver only) |
| `chunkSize` | `number` | | Chunk size passed to mdream for markdown conversion |
| `verbose` | `boolean` | `false` | Enable verbose error logging |
| `onPage` | `(page: PageData) => Promise<void> \| void` | | Callback invoked for each successfully crawled page |

### `CrawlResult`

```typescript
interface CrawlResult {
  url: string
  title: string
  content: string
  filePath?: string // Set when generateIndividualMd is true
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

The shape passed to the `onPage` callback:

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

#### Custom page processing with `onPage`

```typescript
import { crawlAndGenerate } from '@mdream/crawl'

const pages = []

await crawlAndGenerate({
  urls: ['https://docs.example.com'],
  outputDir: './output',
  generateIndividualMd: false,
  generateLlmsTxt: false,
  onPage: (page) => {
    pages.push({
      url: page.url,
      title: page.title,
      description: page.metadata.description,
    })
  },
})

console.log(`Discovered ${pages.length} pages`)
```

#### Glob filtering with exclusions

```typescript
import { crawlAndGenerate } from '@mdream/crawl'

await crawlAndGenerate({
  urls: ['https://example.com/docs/**'],
  outputDir: './docs-output',
  exclude: ['/docs/deprecated/*', '/docs/internal/*'],
  followLinks: true,
  maxDepth: 2,
})
```

#### Single-page mode

Set `maxDepth: 0` to process only the provided URLs without crawling or link following:

```typescript
await crawlAndGenerate({
  urls: ['https://example.com/pricing', 'https://example.com/about'],
  outputDir: './output',
  maxDepth: 0,
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
npx @mdream/crawl -u example.com --driver playwright
```

```typescript
await crawlAndGenerate({
  urls: ['https://spa-app.example.com'],
  outputDir: './output',
  driver: 'playwright',
})
```

Waits for `networkidle` before extracting content. Automatically detects and uses system Chrome when available, falling back to Playwright's bundled browser.

## Sitemap and Robots.txt Discovery

By default, the crawler performs sitemap discovery before crawling:

1. Fetches `robots.txt` to find `Sitemap:` directives and `Crawl-delay` values
2. Loads sitemaps referenced in `robots.txt`
3. Falls back to `/sitemap.xml`
4. Tries common alternatives: `/sitemap_index.xml`, `/sitemaps.xml`, `/sitemap-index.xml`
5. Supports sitemap index files (recursively loads child sitemaps)
6. Filters discovered URLs against glob patterns and exclusion rules

The home page is always included for metadata extraction (site name, description).

Disable with `--skip-sitemap` or `skipSitemap: true`.

## Output Formats

### Individual Markdown Files

One `.md` file per crawled page, written to the output directory preserving the URL path structure. For example, `https://example.com/docs/getting-started` becomes `output/docs/getting-started.md`.

### llms.txt

A site overview file following the [llms.txt specification](https://llmstxt.org/), listing all crawled pages with titles and links to their markdown files.

```markdown
# example.com

## Pages

- [Example Domain](index.md): https://example.com/
- [About Us](about.md): https://example.com/about
```

### llms-full.txt

Same structure as `llms.txt` but includes the full markdown content of every page inline.
