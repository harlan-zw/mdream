import type { EngineOptions } from './types'

/**
 * Engine interface shared by both JavaScript and Rust engines.
 * Methods accept `EngineOptions` — the shared cross-engine contract.
 */
export interface MarkdownEngine {
  htmlToMarkdown: (html: string, options?: EngineOptions) => string
  streamHtmlToMarkdown: (htmlStream: ReadableStream<Uint8Array | string> | null, options?: EngineOptions) => AsyncIterable<string>
}

export * from './const'
export { createPlugin } from './pluggable/plugin'
export * from './preset/minimal'
export type * from './types'
