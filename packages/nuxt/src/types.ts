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
   * @default { minimal: true }
   */
  mdreamOptions?: Partial<MdreamOptions>
}
