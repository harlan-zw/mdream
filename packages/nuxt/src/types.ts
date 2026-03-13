import type { MdreamOptions } from 'mdream'

export type { MdreamLlmsTxtGeneratePayload, MdreamMarkdownContext, MdreamNegotiateContext, ModuleRuntimeConfig } from './runtime/types.js'

export interface ModuleOptions {
  /**
   * Enable/disable the module
   * @default true
   */
  enabled?: boolean

  /**
   * Options to pass to mdream htmlToMarkdown function
   */
  mdreamOptions?: Partial<MdreamOptions> & {
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
