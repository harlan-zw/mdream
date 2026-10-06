import type { CrawlLogger } from './logger.ts'

/** An output file the crawler can write. */
export type CrawlArtifact = 'llms.txt' | 'llms-full.txt' | 'markdown'

/** How the crawler fetches pages. */
export type CrawlDriver = 'http' | 'playwright'

export interface PageData {
  url: string
  html: string
  title: string
  metadata: PageMetadata
  origin: string
}

export interface CrawlHooks {
  'crawl:url': (ctx: { url: string, skip: boolean }) => void | Promise<void>
  'crawl:html': (ctx: { url: string, html: string, origin: string }) => void | Promise<void>
  'crawl:page': (page: PageData) => void | Promise<void>
  'crawl:content': (ctx: { url: string, title: string, content: string, filePath: string }) => void | Promise<void>
  'crawl:done': (ctx: { results: CrawlResult[] }) => void | Promise<void>
}

/**
 * Options for `crawlAndGenerate`, the `mdream.config.*` file, and the CLI.
 * The CLI flag for each option is its kebab-case name (`maxPages` is `--max-pages`).
 */
export interface CrawlOptions {
  /** Starting URLs. Glob patterns such as `example.com/docs/**` limit the crawl. */
  urls: string[]
  /** Output directory. Defaults to `output`. */
  output?: string
  /**
   * Link depth. `0` processes only the given URLs: no sitemap or robots.txt
   * discovery and no link following. `1` or more discovers the sitemap. If the
   * sitemap gives no URLs, the crawler follows links up to `depth` hops from
   * the starting URLs. Integer from 0 to 10. Defaults to `3`.
   */
  depth?: number
  /** Maximum number of pages to fetch. Defaults to no limit. */
  maxPages?: number
  /**
   * Sitemap URL or URLs to use instead of auto-discovery. All parts are loaded
   * and merged. Ignored when `skipSitemap` is set.
   */
  sitemap?: string | string[]
  /** Files to write. Defaults to all three. An empty array writes no files. */
  artifacts?: CrawlArtifact[]
  /** Site name in llms.txt. Defaults to the home page title. */
  siteName?: string
  /** Site description in llms.txt. Defaults to the home page description. */
  description?: string
  /** Origin for relative links in page Markdown. Defaults to each page's own origin. */
  origin?: string
  /** Defaults to `http`. */
  driver?: CrawlDriver
  /** Use the system Chrome with the Playwright driver. Defaults to `false`. */
  useChrome?: boolean
  /** Glob patterns for URLs to skip. */
  exclude?: string[]
  /** Delay between requests in seconds. Defaults to the robots.txt `Crawl-delay`. */
  crawlDelay?: number
  /** Skip sitemap and robots.txt discovery. Defaults to `false`. */
  skipSitemap?: boolean
  /** Crawl other subdomains of the same registrable domain. Defaults to `false`. */
  allowSubdomains?: boolean
  /**
   * Remove repeated site chrome (navigation, footers) from page Markdown and
   * llms-full.txt. Blocks that repeat across the corpus are removed only from
   * the start and end of each page. The llms.txt link index does not change.
   * Needs at least 3 pages. Defaults to `true`.
   */
  stripBoilerplate?: boolean
  /**
   * Fraction of pages a block must appear in to count as chrome. Greater than
   * 0 and at most 1. Higher is stricter. Defaults to `0.5`.
   */
  boilerplateThreshold?: number
  /** Log errors for each failed URL. Defaults to `false`. */
  verbose?: boolean
  /**
   * Drop all diagnostic and progress logs. Use it when stdout must stay clean,
   * for example in an MCP server. An explicit `logger` takes precedence.
   */
  silent?: boolean
  /** Sink for diagnostic and progress logs. Defaults to `@clack/prompts` on stdout. */
  logger?: CrawlLogger
  hooks?: Partial<{ [K in keyof CrawlHooks]: CrawlHooks[K] | CrawlHooks[K][] }>
  /**
   * Parsed URL patterns that replace the patterns parsed from `urls`.
   * Advanced: `urls` covers most needs.
   */
  globPatterns?: ParsedUrlPattern[]
}

/** Type helper for `mdream.config.*`. Every option is optional in the config file. */
export function defineConfig(config: Partial<CrawlOptions>): Partial<CrawlOptions> {
  return config
}

export interface ParsedUrlPattern {
  baseUrl: string
  pattern: string
  isGlob: boolean
}

export interface PageMetadata {
  title: string
  description?: string
  keywords?: string
  author?: string
  links: string[]
}

export interface CrawlResult {
  url: string
  title: string
  content: string
  filePath?: string
  timestamp: number
  success: boolean
  error?: string
  metadata?: PageMetadata
  depth?: number
}

export interface CrawlProgress {
  sitemap: {
    status: 'discovering' | 'processing' | 'completed'
    found: number
    processed: number
  }
  crawling: {
    status: 'starting' | 'processing' | 'completed'
    total: number
    processed: number
    failed: number
    currentUrl?: string
    /** Page fetch latency stats in ms */
    latency: { total: number, min: number, max: number, count: number }
  }
  generation: {
    status: 'idle' | 'generating' | 'completed'
    current?: string
  }
}
