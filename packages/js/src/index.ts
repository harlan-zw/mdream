import type { EngineOptions, MdreamOptions, TransformPlugin } from './types'
import { applyClean, resolveClean } from './clean'
import { createMarkdownProcessor } from './markdown-processor'
import { resolvePlugins } from './resolve-plugins'
import { streamHtmlToMarkdown as _streamHtmlToMarkdown } from './stream'
import { buildTagOverrideHandlers } from './tags'

// Plugin options the mdream (Rust) entry takes at the top level. Here they
// live under `plugins`, so a top-level one would silently do nothing.
const TOP_LEVEL_PLUGIN_KEYS = ['frontmatter', 'isolateMain', 'tailwind', 'filter', 'extraction', 'tagOverrides'] as const

function assertEngineOptions(options: Record<string, unknown>): void {
  if ('minimal' in options) {
    throw new TypeError(
      '@mdream/js has no `minimal` option. '
      + 'Use withMinimalPreset() from \'@mdream/js/preset/minimal\': htmlToMarkdown(html, withMinimalPreset({ origin })).',
    )
  }
  for (const key of TOP_LEVEL_PLUGIN_KEYS) {
    if (key in options) {
      throw new TypeError(
        `@mdream/js reads \`${key}\` from \`plugins\`. `
        + `Pass { plugins: { ${key} } } instead of { ${key} }.`,
      )
    }
  }
}

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
  assertEngineOptions(options)
  const hooks = resolveHooks(options)
  const markdown = convert(html, options, hooks)
  if (options.clean && (options.format === undefined || options.format === 'markdown'))
    return applyClean(markdown, resolveClean(options.clean))
  return markdown
}

export function streamHtmlToMarkdown(
  htmlStream: ReadableStream<Uint8Array | string> | null,
  options: Partial<MdreamOptions> = {},
): AsyncIterable<string> {
  assertEngineOptions(options)
  const hooks = resolveHooks(options)
  const { plugins, callExtractionHandlers, getFrontmatter, frontmatterCallback } = resolvePlugins(options, hooks)
  const tagOverrideHandlers = options.plugins?.tagOverrides
    ? buildTagOverrideHandlers(options.plugins.tagOverrides)
    : undefined
  const stream = _streamHtmlToMarkdown(htmlStream, options, plugins, tagOverrideHandlers)
  if (!callExtractionHandlers && !frontmatterCallback)
    return stream
  return withCallbacks(stream, () => {
    const fm = getFrontmatter?.()
    if (fm && frontmatterCallback)
      frontmatterCallback(fm)
    callExtractionHandlers?.()
  })
}

// Runs the callbacks once the whole document is read, as one-shot conversion does.
async function* withCallbacks(stream: AsyncIterable<string>, onEnd: () => void): AsyncIterable<string> {
  yield* stream
  onEnd()
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
