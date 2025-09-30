import type { HTMLToMarkdownOptions } from 'mdream'
import type { LlmsTxtArtifactsOptions } from 'mdream/llms-txt'

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
  /** Whether this is during prerendering */
  isPrerender: boolean
}

/**
 * Hook context for llms.txt artifacts
 */
export interface MdreamLlmsContext {
  /** The processed files data */
  files: Array<{
    title: string
    content: string
    url: string
  }>
  /** The options that will be passed to generateLlmsTxtArtifacts */
  options: LlmsTxtArtifactsOptions
  /** Whether this is during prerendering */
  isPrerender: boolean
}
