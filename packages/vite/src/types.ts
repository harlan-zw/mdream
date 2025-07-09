import type { HTMLToMarkdownOptions } from 'mdream'
import type { Plugin } from 'vite'

export interface ViteHtmlToMarkdownOptions {
  /**
   * Glob patterns to include HTML files for processing
   * @default ['**\/*.html']
   */
  include?: string[]

  /**
   * Glob patterns to exclude from processing
   * @default ['**\/node_modules\/**']
   */
  exclude?: string[]

  /**
   * Output directory for generated markdown files
   * @default '' (same directory as HTML files)
   */
  outputDir?: string

  /**
   * Enable in-memory caching for development
   * @default true
   */
  cacheEnabled?: boolean

  /**
   * Options to pass to mdream's htmlToMarkdown function
   */
  mdreamOptions?: HTMLToMarkdownOptions

  /**
   * Whether to preserve directory structure in output
   * @default true
   */
  preserveStructure?: boolean

  /**
   * Custom cache TTL in milliseconds for production
   * @default 3600000 (1 hour)
   */
  cacheTTL?: number

  /**
   * Whether to log conversion activities
   * @default false
   */
  verbose?: boolean
}

export interface CacheEntry {
  content: string
  timestamp: number
  ttl: number
}

export interface MarkdownConversionResult {
  content: string
  cached: boolean
  source: 'dev' | 'preview' | 'build'
}

export type ViteHtmlToMarkdownPlugin = (options?: ViteHtmlToMarkdownOptions) => Plugin
