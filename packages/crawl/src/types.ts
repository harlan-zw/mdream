export interface PageData {
  url: string
  html: string
  title: string
  metadata: PageMetadata
  origin: string
}

export interface CrawlHooks {
  'crawl:url': (ctx: { url: string, skip: boolean }) => void | Promise<void>
  'crawl:page': (page: PageData) => void | Promise<void>
  'crawl:content': (ctx: { url: string, title: string, content: string, filePath: string }) => void | Promise<void>
  'crawl:done': (ctx: { results: CrawlResult[] }) => void | Promise<void>
}

export interface CrawlOptions {
  urls: string[]
  outputDir: string
  maxRequestsPerCrawl?: number
  generateLlmsTxt?: boolean
  generateLlmsFullTxt?: boolean
  generateIndividualMd?: boolean
  origin?: string
  chunkSize?: number
  driver?: 'http' | 'playwright'
  useChrome?: boolean
  followLinks?: boolean
  maxDepth?: number
  globPatterns?: ParsedUrlPattern[]
  crawlDelay?: number
  exclude?: string[]
  siteNameOverride?: string
  descriptionOverride?: string
  verbose?: boolean
  skipSitemap?: boolean
  allowSubdomains?: boolean
  hooks?: Partial<{ [K in keyof CrawlHooks]: CrawlHooks[K] | CrawlHooks[K][] }>
  onPage?: (page: PageData) => Promise<void> | void
}

export interface MdreamCrawlConfig {
  exclude?: string[]
  driver?: 'http' | 'playwright'
  maxDepth?: number
  maxPages?: number
  crawlDelay?: number
  skipSitemap?: boolean
  allowSubdomains?: boolean
  verbose?: boolean
  artifacts?: ('llms.txt' | 'llms-full.txt' | 'markdown')[]
  hooks?: Partial<{ [K in keyof CrawlHooks]: CrawlHooks[K] | CrawlHooks[K][] }>
}

export function defineConfig(config: MdreamCrawlConfig): MdreamCrawlConfig {
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
