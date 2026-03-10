import type { EngineOptions, Plugin } from './types'
import { createMarkdownProcessor } from './markdown-processor'
import { resolvePlugins } from './resolve-plugins'
import { streamHtmlToMarkdown } from './stream'

/**
 * Engine interface shared by both JavaScript and Rust engines.
 * Methods accept `EngineOptions` — the shared cross-engine contract.
 */
export interface MarkdownEngine {
  htmlToMarkdown: (html: string, options?: EngineOptions) => string
  streamHtmlToMarkdown: (htmlStream: ReadableStream<Uint8Array | string> | null, options?: EngineOptions) => AsyncIterable<string>
}

/**
 * Creates a JavaScript-powered markdown engine.
 * @param transforms - Optional imperative transform plugins (JS-engine-only feature)
 */
export function createJavaScriptEngine(transforms?: Plugin[]): MarkdownEngine {
  return {
    htmlToMarkdown(html: string, options: EngineOptions = {}): string {
      const resolved = resolvePlugins(options, transforms)
      const processor = createMarkdownProcessor(options, resolved)
      processor.processHtml(html)
      return processor.getMarkdown()
    },
    streamHtmlToMarkdown(htmlStream, options: EngineOptions = {}) {
      const resolved = resolvePlugins(options, transforms)
      return streamHtmlToMarkdown(htmlStream, options, resolved)
    },
  }
}

export * from './const'
export { parseHtml } from './parse'
export { createPlugin } from './pluggable/plugin'
export * from './plugins'
export * from './preset/minimal'
export { resolvePlugins } from './resolve-plugins'
export * from './splitter'
export type * from './types'
