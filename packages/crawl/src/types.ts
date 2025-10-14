export interface PageData {
  url: string
  html: string
  title: string
  metadata: PageMetadata
  origin: string
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
  onPage?: (page: PageData) => Promise<void> | void
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

export interface LlmsTxtOptions {
  siteName: string
  description?: string
  results: CrawlResult[]
  outputPath: string
}
