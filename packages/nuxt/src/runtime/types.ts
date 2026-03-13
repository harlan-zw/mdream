import type { MdreamOptions } from 'mdream'

export interface ModuleRuntimeConfig {
  enabled: boolean
  mdreamOptions?: Partial<MdreamOptions> & {
    preset?: 'minimal'
  }
  cache: {
    maxAge: number
    swr: boolean
  }
}

export interface MdreamPage {
  url: string
  title: string
  markdown: string
  html?: string
  description?: string
}

/**
 * Hook context for markdown processing
 */
export interface MdreamMarkdownContext {
  /** The original HTML content */
  html: string
  /** The generated markdown content */
  markdown: string
  /** The route being processed */
  route: string
  /** The page title extracted from HTML */
  title: string
  /** Page description extracted from meta tags or content */
  description: string
  /** Whether this is during prerendering */
  isPrerender: boolean
  /** The H3 event object for accessing request/response */
  event: import('h3').H3Event
}

/**
 * Hook context for content negotiation override
 */
export interface MdreamNegotiateContext {
  /** The H3 event object for accessing request headers */
  event: import('h3').H3Event
  /** Whether markdown should be served - modify this to override */
  shouldServe: boolean
}

/**
 * Hook payload for mdream:llms-txt
 */
export interface MdreamLlmsTxtGeneratePayload {
  /** Current llms.txt content - modify this directly */
  content: string
  /** Current llms-full.txt content - modify this directly */
  fullContent: string
  /** All routes with their metadata (read-only) */
  pages: import('@mdream/llms-txt').ProcessedFile[]
}
