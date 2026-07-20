import type { BuiltinPlugins, MdreamOptions, TransformPlugin } from './types'
import { createMarkdownProcessor } from './markdown-processor'
import { streamHtmlToMarkdown as createMarkdownStream } from './stream'
import { buildTagOverrideHandlers } from './tags'

/** Imperative plugin used by the tree-shakable converter. */
export type Plugin = TransformPlugin

/**
 * Options for the tree-shakable conversion entry. Import plugin factories
 * explicitly and pass their results as an array, matching the pre-v1 JS API.
 * Declarative built-in plugin config and cleanup live on the package root.
 */
export type CoreOptions = Omit<MdreamOptions, 'plugins' | 'clean'> & {
  plugins?: Plugin[] | Pick<BuiltinPlugins, 'tagOverrides'>
}

function resolveHooks(options: CoreOptions): TransformPlugin[] {
  const plugins = Array.isArray(options.plugins) ? options.plugins : undefined
  const hooks = options.hooks?.length ? options.hooks : undefined
  if (!plugins?.length)
    return hooks || []
  if (!hooks)
    return plugins
  return [...plugins, ...hooks]
}

function resolveTagOverrides(options: CoreOptions) {
  return !Array.isArray(options.plugins) ? options.plugins?.tagOverrides : undefined
}

/** Convert HTML without bundling the optional declarative built-in plugins. */
export function htmlToMarkdown(html: string, options: CoreOptions = {}): string {
  const plugins = resolveHooks(options)
  const tagOverrides = resolveTagOverrides(options)
  const tagOverrideHandlers = tagOverrides
    ? buildTagOverrideHandlers(tagOverrides)
    : undefined
  const processor = createMarkdownProcessor(options as MdreamOptions, plugins, tagOverrideHandlers)
  processor.processHtml(html)
  return processor.getMarkdown()
}

/** Stream HTML conversion without bundling declarative built-in plugins. */
export function streamHtmlToMarkdown(
  htmlStream: ReadableStream<Uint8Array | string> | null,
  options: CoreOptions = {},
): AsyncIterable<string> {
  const plugins = resolveHooks(options)
  const tagOverrides = resolveTagOverrides(options)
  const tagOverrideHandlers = tagOverrides
    ? buildTagOverrideHandlers(tagOverrides)
    : undefined
  return createMarkdownStream(htmlStream, options as MdreamOptions, plugins, tagOverrideHandlers)
}
