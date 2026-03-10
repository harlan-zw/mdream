import type { HTMLToMarkdownOptions } from 'mdream'

export type { MdreamLlmsTxtGeneratePayload, MdreamMarkdownContext, MdreamNegotiateContext } from './runtime/types.js'

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
