import type { H3Event } from 'h3'
import type { HTMLToMarkdownOptions } from 'mdream'
import type { ProcessedFile } from 'mdream/llms-txt'

/**
 * Module hooks for @mdream/nuxt
 * These hooks are available at build time in nuxt.config.ts
 */
export interface ModuleHooks {
  /**
   * Called once after all routes are processed, before writing llms.txt files.
   * Uses mutable pattern - modify payload.content and payload.fullContent directly.
   */
  'mdream:llms-txt': (payload: MdreamLlmsTxtGeneratePayload) => void | Promise<void>
}

export interface ModuleOptions {
  /**
   * Enable/disable the module
   * @default true
   */
  enabled?: boolean

  /**
   * Options to pass to mdream htmlToMarkdown function
   */
  mdreamOptions?: HTMLToMarkdownOptions & {
    /**
     * Preset to apply to the htmlToMarkdown function
     */
    preset?: 'minimal'
  }

  /**
   * Cache configuration
   */
  cache?: {
    /**
     * Cache duration in seconds
     * @default 3600 (1 hour)
     */
    maxAge?: number
    /**
     * Enable stale-while-revalidate
     * @default true
     */
    swr?: boolean
  }
}

export interface ModuleRuntimeConfig {
  enabled: boolean
  mdreamOptions: ModuleOptions['mdreamOptions']
  cache: Required<NonNullable<ModuleOptions['cache']>>
}

/**
 * Hook context for markdown processing (Nitro runtime hook)
 *
 * This hook is called during HTML→Markdown conversion in the runtime middleware.
 * You can modify the markdown content before it's returned to the client.
 *
 * @example Modify markdown content
 * nitroApp.hooks.hook('mdream:markdown', async (context) => {
 *   // Add a footer to all markdown
 *   context.markdown += '\n\n---\n*Generated with mdream*'
 * })
 *
 * @example Track conversions and add headers
 * nitroApp.hooks.hook('mdream:markdown', async (context) => {
 *   console.log(`Converted ${context.route} (${context.title})`)
 *
 *   // Add custom headers
 *   if (context.event) {
 *     setHeader(context.event, 'X-Markdown-Title', context.title)
 *   }
 * })
 */
export interface MdreamMarkdownContext {
  /** The original HTML content */
  html: string
  /** The generated markdown content - modify this to change output */
  markdown: string
  /** The route being processed (e.g., '/about') */
  route: string
  /** The page title extracted from HTML */
  title: string
  /** Page description extracted from meta tags or content */
  description: string
  /** Whether this is during prerendering (true) or runtime (false) */
  isPrerender: boolean
  /** The H3 event object for accessing request/response */
  event: H3Event
}

/**
 * Hook payload for mdream:llms-txt
 * Called after mdream has generated llms.txt, before writing to disk
 *
 * IMPORTANT: This uses a mutable pattern. Hooks should modify the content
 * and fullContent properties directly rather than returning values.
 *
 * @example
 * nuxt.hooks.hook('mdream:llms-txt', async (payload) => {
 *   payload.content += '\n\n## Custom Section\n\nAdded by hook!'
 *   payload.fullContent += '\n\n## Custom Section (Full)\n\nAdded by hook!'
 * })
 */
export interface MdreamLlmsTxtGeneratePayload {
  /** Current llms.txt content - modify this directly */
  content: string
  /** Current llms-full.txt content - modify this directly */
  fullContent: string
  /** All routes with their metadata (read-only) */
  pages: ProcessedFile[]
}
