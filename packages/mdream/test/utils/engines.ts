import type { EngineOptions, MdreamOptions, TagOverride, TransformPlugin } from '@mdream/js'
import type { FrontmatterPluginOptions } from '@mdream/js/plugins'
import type { ExtractedElement, MdreamOptions as RustMdreamOptions } from '../../src'
import { htmlToMarkdown as jsHtmlToMarkdown, streamHtmlToMarkdown as jsStreamHtmlToMarkdown } from '@mdream/js'
import { clean } from '@mdream/js/clean'
import { htmlToSafeHtml as jsHtmlToSafeHtml, streamHtmlToSafeHtml as jsStreamHtmlToSafeHtml } from '@mdream/js/html'
import { extractionPlugin, filterPlugin, frontmatterPlugin, isolateMainPlugin, tailwindPlugin } from '@mdream/js/plugins'
import { htmlToText as jsHtmlToText, streamHtmlToText as jsStreamHtmlToText } from '@mdream/js/text'
import { htmlToMarkdown as _rustHtmlToMarkdown, streamHtmlToMarkdown as _rustStreamHtmlToMarkdown } from '../../src'

interface TestBuiltinPlugins {
  filter?: {
    include?: string[]
    exclude?: string[]
    processChildren?: boolean
  }
  frontmatter?: boolean | ((frontmatter: Record<string, string>) => void) | FrontmatterPluginOptions
  isolateMain?: boolean
  tailwind?: boolean
  extraction?: Record<string, (element: ExtractedElement) => void>
  tagOverrides?: Record<string, TagOverride | string>
}

interface TestOptions extends EngineOptions {
  format?: 'markdown' | 'text' | 'html'
  plugins?: TestBuiltinPlugins | TransformPlugin[]
  hooks?: TransformPlugin[]
}

// Convert EngineOptions (plugins-based) to flat RustMdreamOptions
function toFlatOptions(options?: TestOptions): Partial<RustMdreamOptions> {
  const flat: Partial<RustMdreamOptions> = {
    minimal: false,
    origin: options?.origin,
    wrapWidth: options?.wrapWidth,
    format: options?.format,
  }
  const p = Array.isArray(options?.plugins) ? undefined : options?.plugins
  if (p) {
    if (p.frontmatter != null)
      flat.frontmatter = p.frontmatter as RustMdreamOptions['frontmatter']
    if (p.isolateMain != null)
      flat.isolateMain = p.isolateMain
    if (p.tailwind != null)
      flat.tailwind = p.tailwind
    if (p.filter != null)
      flat.filter = p.filter
    if (p.extraction != null)
      flat.extraction = p.extraction as RustMdreamOptions['extraction']
    if (p.tagOverrides != null)
      flat.tagOverrides = p.tagOverrides
  }
  if (options?.clean != null)
    (flat as any).clean = options.clean
  return flat
}

function toJsOptions(options?: TestOptions): MdreamOptions {
  if (!options)
    return {}

  const { format: _format, hooks, plugins: configuredPlugins, ...conversionOptions } = options
  const builtinPlugins = Array.isArray(configuredPlugins) ? undefined : configuredPlugins
  const plugins = Array.isArray(configuredPlugins) ? [...configuredPlugins] : []

  if (builtinPlugins?.frontmatter) {
    const frontmatter = builtinPlugins.frontmatter
    const frontmatterOptions = typeof frontmatter === 'function'
      ? { onExtract: frontmatter }
      : frontmatter === true ? {} : frontmatter
    plugins.push(frontmatterPlugin(frontmatterOptions))
  }
  if (builtinPlugins?.isolateMain)
    plugins.push(isolateMainPlugin())
  if (builtinPlugins?.tailwind)
    plugins.push(tailwindPlugin())
  if (builtinPlugins?.filter)
    plugins.push(filterPlugin(builtinPlugins.filter))
  if (builtinPlugins?.extraction) {
    const selectors = Object.fromEntries(Object.entries(builtinPlugins.extraction).map(([selector, callback]) => [
      selector,
      (element: Parameters<Parameters<typeof extractionPlugin>[0][string]>[0]) => callback({
        selector,
        tagName: element.name,
        textContent: element.textContent,
        attributes: element.attributes,
      }),
    ]))
    plugins.push(extractionPlugin(selectors))
  }
  // v1 ran hooks after the declarative built-ins.
  if (hooks)
    plugins.push(...hooks)

  const { clean: cleanOption, ...rest } = conversionOptions
  return {
    ...rest,
    clean: cleanOption ? clean(cleanOption === true ? undefined : cleanOption) : undefined,
    plugins,
    tagOverrides: builtinPlugins?.tagOverrides ?? conversionOptions.tagOverrides,
  }
}

function rustHtmlToMarkdown(html: string, options?: TestOptions): string {
  return _rustHtmlToMarkdown(html, toFlatOptions(options))
}
function rustStreamHtmlToMarkdown(htmlStream: ReadableStream<Uint8Array | string> | null, options?: TestOptions): AsyncIterable<string> {
  return _rustStreamHtmlToMarkdown(htmlStream, toFlatOptions(options))
}

function jsConvert(html: string, options?: TestOptions): string {
  const conversionOptions = toJsOptions(options)
  if (options?.format === 'text')
    return jsHtmlToText(html, conversionOptions)
  if (options?.format === 'html')
    return jsHtmlToSafeHtml(html, conversionOptions)
  return jsHtmlToMarkdown(html, conversionOptions)
}

function jsStreamConvert(htmlStream: ReadableStream<Uint8Array | string> | null, options?: TestOptions): AsyncIterable<string> {
  const conversionOptions = toJsOptions(options)
  if (options?.format === 'text')
    return jsStreamHtmlToText(htmlStream, conversionOptions)
  if (options?.format === 'html')
    return jsStreamHtmlToSafeHtml(htmlStream, conversionOptions)
  return jsStreamHtmlToMarkdown(htmlStream, conversionOptions)
}

/**
 * Engine-like object for test compatibility.
 * Mirrors the old MarkdownEngine shape so existing tests work unchanged.
 */
interface TestEngine {
  htmlToMarkdown: (html: string, options?: TestOptions) => string
  streamHtmlToMarkdown: (htmlStream: ReadableStream<Uint8Array | string> | null, options?: TestOptions) => AsyncIterable<string>
}

export const engines: Array<{ name: string, engine: TestEngine }> = [
  {
    name: 'JavaScript Engine',
    engine: {
      htmlToMarkdown(html, options) {
        return jsConvert(html, options)
      },
      streamHtmlToMarkdown(stream, options) {
        return jsStreamConvert(stream, options)
      },
    },
  },
  {
    name: 'Rust Engine',
    engine: {
      htmlToMarkdown: rustHtmlToMarkdown,
      streamHtmlToMarkdown: rustStreamHtmlToMarkdown,
    },
  },
]

export async function resolveEngine(engine: TestEngine): Promise<TestEngine> {
  return engine
}

/**
 * Test helper — same signature tests already use: `htmlToMarkdown(html, { engine, ...opts })`
 */
export function htmlToMarkdown(html: string, options: { engine?: TestEngine } & Partial<TestOptions> = {}): string {
  const { engine, ...rest } = options
  if (!engine)
    throw new Error('engine required in test htmlToMarkdown')
  return engine.htmlToMarkdown(html, rest)
}

/**
 * Test helper — same signature tests already use: `streamHtmlToMarkdown(stream, { engine, ...opts })`
 */
export function streamHtmlToMarkdown(
  htmlStream: ReadableStream<Uint8Array | string> | null,
  options: { engine?: TestEngine } & Partial<TestOptions> = {},
): AsyncIterable<string> {
  const { engine, ...rest } = options
  if (!engine)
    throw new Error('engine required in test streamHtmlToMarkdown')
  return engine.streamHtmlToMarkdown(htmlStream, rest)
}
