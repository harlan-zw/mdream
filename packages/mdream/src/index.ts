import type { HtmlToMarkdownOptions, PluginOptions, TagOverrideNapi } from '../napi/index.js'
import { htmlToMarkdown as _htmlToMarkdown, MarkdownStream as _MarkdownStream } from '../napi/index.mjs'

export interface CleanOptions {
  /** Strip tracking query parameters (utm_*, fbclid, gclid, etc.) from URLs */
  urls?: boolean
  /** Strip fragment-only links that don't match any heading in the output */
  fragments?: boolean
  /** Strip links with meaningless hrefs (#, javascript:void(0)) → plain text */
  emptyLinks?: boolean
  /** Collapse 3+ consecutive blank lines to 2 */
  blankLines?: boolean
  /** Strip links where text equals URL: [https://x.com](https://x.com) → https://x.com */
  redundantLinks?: boolean
  /** Strip self-referencing heading anchors: ## [Title](#title) → ## Title */
  selfLinkHeadings?: boolean
  /** Strip images with no alt text (decorative/tracking pixels) */
  emptyImages?: boolean
  /** Drop links that produce no visible text: [](url) → nothing */
  emptyLinkText?: boolean
}

export interface ExtractedElement {
  selector: string
  tagName: string
  textContent: string
  attributes: Record<string, string>
}

export interface FrontmatterConfig {
  additionalFields?: Record<string, string>
  metaFields?: string[]
  /** Callback to receive structured frontmatter data after conversion */
  onExtract?: (frontmatter: Record<string, string>) => void
}

export interface TagOverride {
  enter?: string
  exit?: string
  spacing?: number[]
  isInline?: boolean
  isSelfClosing?: boolean
  collapsesInnerWhiteSpace?: boolean
  alias?: string
}

export interface MdreamOptions {
  /** Origin URL for resolving relative image paths and internal links. */
  origin?: string
  /**
   * Clean up the markdown output. Pass `true` for all cleanup or an object
   * to enable specific features. `clean.urls` is handled during conversion;
   * other options are post-processing steps (sync API only).
   */
  clean?: boolean | CleanOptions
  /** Enable minimal preset (frontmatter, isolateMain, tailwind, filter). Default: false */
  minimal?: boolean
  /**
   * Extract frontmatter from HTML head.
   * - `true`: enable with defaults
   * - `(fm) => void`: enable and receive structured data via callback
   * - `FrontmatterConfig`: enable with config options and optional callback
   */
  frontmatter?: boolean | ((frontmatter: Record<string, string>) => void) | FrontmatterConfig
  /** Isolate main content area. Default when minimal: true */
  isolateMain?: boolean
  /** Convert Tailwind utility classes. Default when minimal: true */
  tailwind?: boolean
  /** Filter elements. Default when minimal: excludes form, nav, footer, etc. */
  filter?: { include?: string[], exclude?: string[], processChildren?: boolean }
  /** Extract elements matching CSS selectors */
  extraction?: Record<string, (element: ExtractedElement) => void>
  /** Tag overrides. String values act as aliases */
  tagOverrides?: Record<string, TagOverride | string>
}

const MINIMAL_FILTER_EXCLUDE = ['form', 'fieldset', 'object', 'embed', 'footer', 'aside', 'iframe', 'input', 'textarea', 'select', 'button', 'nav'] as const
const MINIMAL_FILTER_DEFAULT = { exclude: MINIMAL_FILTER_EXCLUDE as unknown as string[] }

const CLEAN_ALL: CleanOptions = { urls: true, fragments: true, emptyLinks: true, redundantLinks: true, selfLinkHeadings: true, emptyImages: true, emptyLinkText: true }

function resolveCleanConfig(options: Partial<MdreamOptions>, minimal: boolean): { cleanUrls: boolean, clean?: CleanOptions } {
  let cleanOpt = options.clean
  if (cleanOpt === undefined && minimal)
    cleanOpt = true
  if (!cleanOpt)
    return { cleanUrls: false }
  const resolved = cleanOpt === true ? CLEAN_ALL : cleanOpt
  return {
    cleanUrls: resolved.urls || false,
    clean: resolved,
  }
}

interface ResolvedOptions {
  napiOpts: HtmlToMarkdownOptions
  extractionHandlers?: Record<string, (el: ExtractedElement) => void>
  frontmatterCallback?: (fm: Record<string, string>) => void
}

function resolveFrontmatter(opt: MdreamOptions['frontmatter']): { config?: object, callback?: (fm: Record<string, string>) => void } {
  if (typeof opt === 'function')
    return { config: {}, callback: opt }
  if (typeof opt === 'object')
    return { config: opt, callback: opt.onExtract }
  return { config: {} }
}

function resolveOptions(options: Partial<MdreamOptions>): ResolvedOptions {
  const minimal = options.minimal === true
  const plugins: PluginOptions = {}
  let frontmatterCallback: ((fm: Record<string, string>) => void) | undefined

  const enableFm = minimal ? options.frontmatter !== false : !!options.frontmatter
  if (enableFm) {
    const fm = resolveFrontmatter(options.frontmatter)
    plugins.frontmatter = fm.config
    frontmatterCallback = fm.callback
  }
  if (minimal ? options.isolateMain !== false : options.isolateMain)
    plugins.isolateMain = true
  if (minimal ? options.tailwind !== false : options.tailwind)
    plugins.tailwind = true
  if (minimal)
    plugins.filter = options.filter || MINIMAL_FILTER_DEFAULT
  else if (options.filter)
    plugins.filter = options.filter

  let extractionHandlers: Record<string, (el: ExtractedElement) => void> | undefined
  if (options.extraction) {
    plugins.extraction = { selectors: Object.keys(options.extraction) }
    extractionHandlers = options.extraction
  }

  if (options.tagOverrides) {
    const overrides: Record<string, TagOverrideNapi> = {}
    for (const tag in options.tagOverrides) {
      const v = options.tagOverrides[tag]
      if (v)
        overrides[tag] = typeof v === 'string' ? { alias: v } : v
    }
    plugins.tagOverrides = overrides
  }

  const { cleanUrls, clean } = resolveCleanConfig(options, minimal)

  return {
    napiOpts: { origin: options.origin, cleanUrls, clean, plugins },
    extractionHandlers,
    frontmatterCallback,
  }
}

export function htmlToMarkdown(html: string, options: Partial<MdreamOptions> = {}): string {
  if (Array.isArray((options as any).plugins)) {
    throw new TypeError(
      'Custom hook plugins require @mdream/js. '
      + 'Pass declarative config (e.g. { frontmatter: true }) to the Rust engine, '
      + 'or import { htmlToMarkdown } from \'@mdream/js\' for hook-based plugins. '
      + 'See https://mdream.dev/v1-migration#custom-plugins',
    )
  }
  const { napiOpts, extractionHandlers, frontmatterCallback } = resolveOptions(options)
  const napiResult = _htmlToMarkdown(html, napiOpts)
  if (napiResult.frontmatter && frontmatterCallback)
    frontmatterCallback(napiResult.frontmatter)
  if (napiResult.extracted?.length && extractionHandlers) {
    for (const el of napiResult.extracted)
      extractionHandlers[el.selector]?.(el)
  }
  return napiResult.markdown
}

export async function* streamHtmlToMarkdown(
  htmlStream: ReadableStream<Uint8Array | string> | null,
  options: Partial<MdreamOptions> = {},
): AsyncIterable<string> {
  if (!htmlStream)
    throw new Error('Invalid HTML stream provided')
  const { napiOpts } = resolveOptions(options)
  const stream = new _MarkdownStream(napiOpts)
  const reader = htmlStream.getReader()
  const decoder = new TextDecoder()
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done)
        break
      const chunk = typeof value === 'string' ? value : decoder.decode(value)
      const processed = stream.processChunk(chunk)
      if (processed)
        yield processed
    }
    const final_ = stream.finish()
    if (final_)
      yield final_
  }
  finally {
    reader.releaseLock()
  }
}
