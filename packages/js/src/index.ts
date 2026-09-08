import type { MdreamOptions } from './types'
import { applyClean, resolveClean } from './clean'
import { createMarkdownProcessor } from './markdown-processor'
import { streamHtmlToMarkdown as _streamHtmlToMarkdown } from './stream'
import { buildTagOverrideHandlers } from './tag-overrides'
import { tagHandlers } from './tags'

function convert(html: string, options: MdreamOptions): string {
  const tagOverrideHandlers = options.tagOverrides
    ? buildTagOverrideHandlers(options.tagOverrides, tagHandlers)
    : undefined
  const processor = createMarkdownProcessor(options, options.plugins, tagOverrideHandlers)
  processor.processHtml(html)
  return processor.getMarkdown()
}

export function htmlToMarkdown(html: string, options: Partial<MdreamOptions> = {}): string {
  const markdown = convert(html, options)
  if (options.clean)
    return applyClean(markdown, resolveClean(options.clean))
  return markdown
}

export function streamHtmlToMarkdown(
  htmlStream: ReadableStream<Uint8Array | string> | null,
  options: Partial<MdreamOptions> = {},
): AsyncIterable<string> {
  const tagOverrideHandlers = options.tagOverrides
    ? buildTagOverrideHandlers(options.tagOverrides, tagHandlers)
    : undefined
  return _streamHtmlToMarkdown(htmlStream, options, options.plugins, tagOverrideHandlers)
}

export { ELEMENT_NODE, NodeEventEnter, NodeEventExit, TAG_H1, TAG_H2, TAG_H3, TAG_H4, TAG_H5, TAG_H6, TEXT_NODE } from './const'
export { createPlugin } from './pluggable/plugin'
export type { MdreamOptions } from './types'
export type {
  CleanOptions,
  ElementNode,
  EngineOptions,
  ExtractedElement,
  MarkdownChunk,
  Node,
  NodeEvent,
  OutputFormat,
  Plugin,
  PluginContext,
  SplitterOptions,
  TagOverride,
  TextNode,
  TransformPlugin,
} from './types'
