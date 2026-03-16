import type { EngineOptions, MdreamOptions, TransformPlugin } from './types'
import { applyClean, resolveClean } from './clean'
import { createMarkdownProcessor } from './markdown-processor'
import { resolvePlugins } from './resolve-plugins'
import { streamHtmlToMarkdown as _streamHtmlToMarkdown } from './stream'
import { buildTagOverrideHandlers } from './tags'

function resolveHooks(options: Partial<MdreamOptions>): TransformPlugin[] | undefined {
  return options.hooks?.length ? options.hooks : undefined
}

function convert(html: string, options: EngineOptions, hooks?: TransformPlugin[]): string {
  const { plugins, callExtractionHandlers, getFrontmatter, frontmatterCallback } = resolvePlugins(options, hooks)
  const tagOverrideHandlers = options.plugins?.tagOverrides
    ? buildTagOverrideHandlers(options.plugins.tagOverrides)
    : undefined
  const processor = createMarkdownProcessor(options, plugins, tagOverrideHandlers)
  processor.processHtml(html)
  if (getFrontmatter && frontmatterCallback) {
    const fm = getFrontmatter()
    if (fm)
      frontmatterCallback(fm)
  }
  callExtractionHandlers?.()
  return processor.getMarkdown()
}

export function htmlToMarkdown(html: string, options: Partial<MdreamOptions> = {}): string {
  const hooks = resolveHooks(options)
  const markdown = convert(html, options, hooks)
  if (options.clean)
    return applyClean(markdown, resolveClean(options.clean))
  return markdown
}

export function streamHtmlToMarkdown(
  htmlStream: ReadableStream<Uint8Array | string> | null,
  options: Partial<MdreamOptions> = {},
): AsyncIterable<string> {
  const hooks = resolveHooks(options)
  const { plugins } = resolvePlugins(options, hooks)
  const tagOverrideHandlers = options.plugins?.tagOverrides
    ? buildTagOverrideHandlers(options.plugins.tagOverrides)
    : undefined
  return _streamHtmlToMarkdown(htmlStream, options, plugins, tagOverrideHandlers)
}

export { ELEMENT_NODE, NodeEventEnter, NodeEventExit, TAG_H1, TAG_H2, TAG_H3, TAG_H4, TAG_H5, TAG_H6, TEXT_NODE } from './const'
export { createPlugin } from './pluggable/plugin'
export { withMinimalPreset } from './preset/minimal'
export type { MdreamOptions } from './types'
export type {
  BuiltinPlugins,
  CleanOptions,
  ElementNode,
  EngineOptions,
  ExtractedElement,
  FrontmatterConfig,
  MarkdownChunk,
  Node,
  NodeEvent,

  PluginContext,
  SplitterOptions,
  TagOverride,
  TextNode,
  TransformPlugin,
} from './types'
