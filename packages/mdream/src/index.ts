import type { MarkdownEngine } from '@mdream/engine-js'
import type { MdreamOptions } from './types.js'
import { createJavaScriptEngine } from '@mdream/engine-js'

let defaultEngine: MarkdownEngine | undefined

function getDefaultEngine(): MarkdownEngine {
  if (!defaultEngine) {
    defaultEngine = createJavaScriptEngine()
  }
  return defaultEngine
}

export function htmlToMarkdown(
  html: string,
  options: MdreamOptions = {},
): string {
  // Transforms require the JS engine — create one with transforms baked in
  if (options.transforms?.length) {
    return createJavaScriptEngine(options.transforms).htmlToMarkdown(html, options)
  }
  const engine = options.engine || getDefaultEngine()
  return engine.htmlToMarkdown(html, options)
}

export function streamHtmlToMarkdown(
  htmlStream: ReadableStream<Uint8Array | string> | null,
  options: MdreamOptions = {},
): AsyncIterable<string> {
  if (options.transforms?.length) {
    return createJavaScriptEngine(options.transforms).streamHtmlToMarkdown(htmlStream, options)
  }
  const engine = options.engine || getDefaultEngine()
  return engine.streamHtmlToMarkdown(htmlStream, options)
}

export { createEngine, createRustEngine } from './engine.js'
export type { MdreamOptions } from './types.js'

// Engine factories
export { createJavaScriptEngine } from '@mdream/engine-js'

// Types
export type {
  ElementNode,
  EngineOptions,
  MarkdownChunk,
  MarkdownEngine,
  Node,
  NodeEvent,
  Plugin,
  PluginConfig,
  PluginContext,
  SplitterOptions,
  TextNode,
} from '@mdream/engine-js'
