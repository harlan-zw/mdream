import type { MdreamOptions } from './types'
import { createMarkdownProcessor } from './markdown-processor'
import { resolvePlugins } from './pluggable/plugin'
import { streamHtmlToMarkdown as _streamHtmlToMarkdown } from './stream'
import { buildTagOverrideHandlers } from './tag-overrides'
import { tagHandlers } from './tags'

function convert(html: string, options: MdreamOptions): string {
  const tagOverrideHandlers = options.tagOverrides
    ? buildTagOverrideHandlers(options.tagOverrides, tagHandlers)
    : undefined
  const processor = createMarkdownProcessor(options, resolvePlugins(options.plugins), tagOverrideHandlers)
  processor.processHtml(html)
  return processor.getMarkdown()
}

export function htmlToMarkdown(html: string, options: Partial<MdreamOptions> = {}): string {
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
