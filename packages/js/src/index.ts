import type { ParseState } from './parse'
import type { MdreamOptions, NodeEvent } from './types'
import { createMarkdownProcessor, trimAsciiWhitespaceEnd } from './markdown-processor'
import { assertEngineOptions } from './option-shape'
import { finalizeParse, parseHtmlStream } from './parse'
import { resolvePlugins } from './pluggable/plugin'
import { endPlugins, processPluginsForEvent } from './plugin-processor'
import { streamHtmlToMarkdown as _streamHtmlToMarkdown } from './stream'
import { buildTagOverrideHandlers } from './tag-overrides'
import { tagHandlers } from './tags'
import { trimOutputStart } from './utils'

function convert(html: string, options: MdreamOptions): string {
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
  // Only ASCII whitespace ends the output, as in Rust: U+00A0 is content,
  // and a stream cannot take back a nbsp it already yielded.
  const markdown = trimAsciiWhitespaceEnd(trimOutputStart(processor.state.buffer.join('')))
  processor.state.buffer.length = 0
  return markdown
}

export function htmlToMarkdown(html: string, options: Partial<MdreamOptions> = {}): string {
  assertEngineOptions(options)
  const markdown = convert(html, options)
  const clean = options.clean
  if (!clean)
    return markdown
  if (typeof clean.apply !== 'function')
    throw new TypeError('The clean option needs cleanup rules from clean(). Import it from \'@mdream/js/clean\'.')
  return clean.apply(markdown)
}

export function streamHtmlToMarkdown(
  htmlStream: ReadableStream<Uint8Array | string> | null,
  options: Partial<MdreamOptions> = {},
): AsyncIterable<string> {
  assertEngineOptions(options)
  const tagOverrideHandlers = options.tagOverrides
    ? buildTagOverrideHandlers(options.tagOverrides, tagHandlers)
    : undefined
  return _streamHtmlToMarkdown(htmlStream, options, resolvePlugins(options.plugins), tagOverrideHandlers)
}

export { ELEMENT_NODE, NodeEventEnter, NodeEventExit, TAG_H1, TAG_H2, TAG_H3, TAG_H4, TAG_H5, TAG_H6, TEXT_NODE } from './const'
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
  SplitterOptions,
  TagOverride,
  TextNode,
  TransformPlugin,
} from './types'
