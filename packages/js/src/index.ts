import type { ParseState } from './parse'
import type { MdreamOptions, NodeEvent } from './types'
import { createMarkdownProcessor } from './markdown-processor'
import { assertEngineOptions, checkClean } from './option-shape'
import { finalizeParse, parseHtmlStream } from './parse'
import { resolvePlugins } from './pluggable/plugin'
import { endPlugins, processPluginsForEvent } from './plugin-processor'
import { streamHtmlToMarkdown as _streamHtmlToMarkdown } from './stream'
import { buildTagOverrideHandlers } from './tag-overrides'
import { tagHandlers } from './tags'

export function htmlToMarkdown(html: string, options: Partial<MdreamOptions> = {}): string {
  assertEngineOptions(options)
  checkClean(options)
  const tagOverrideHandlers = options.tagOverrides
    ? buildTagOverrideHandlers(options.tagOverrides, tagHandlers)
    : undefined
  const plugins = resolvePlugins(options.plugins)
  const processor = createMarkdownProcessor(options)
  const parseState: ParseState = {
    depthMap: processor.state.depthMap,
    depth: 0,
    resolvedPlugins: plugins,
    tagHandlers,
    tagOverrideHandlers,
    plainText: false,
  }
  const handleEvent: (event: NodeEvent) => void = plugins.length
    ? event => processPluginsForEvent(event, plugins, processor.state, processor.processEvent)
    : processor.processEvent
  const leftover = parseHtmlStream(html, parseState, handleEvent)
  finalizeParse(leftover, parseState, handleEvent)
  endPlugins(plugins, processor.state)
  return processor.getMarkdown()
}

export function streamHtmlToMarkdown(
  htmlStream: ReadableStream<Uint8Array | string> | null,
  options: Partial<MdreamOptions> = {},
): AsyncIterable<string> {
  assertEngineOptions(options)
  checkClean(options)
  const tagOverrideHandlers = options.tagOverrides
    ? buildTagOverrideHandlers(options.tagOverrides, tagHandlers)
    : undefined
  return _streamHtmlToMarkdown(htmlStream, options, resolvePlugins(options.plugins), tagOverrideHandlers)
}

export { ELEMENT_NODE, NodeEventEnter, NodeEventExit, TEXT_NODE } from './const'
export { createPlugin } from './pluggable/plugin'
export type { ExtractedElement } from './plugins/extraction'
export type { MdreamOptions } from './types'
export type {
  Cleaner,
  CleanOptions,
  ElementNode,
  EngineOptions,
  MarkdownChunk,
  Node,
  NodeEvent,
  OutputFormat,
  Plugin,
  PluginContext,
  PluginSetup,
  PluginState,
  SplitterOptions,
  TagOverride,
  TextNode,
  TransformPlugin,
} from './types'
