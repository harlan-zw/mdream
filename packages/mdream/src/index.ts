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

export interface MdreamResult {
  markdown: string
  extracted?: ExtractedElement[]
  frontmatter?: Record<string, string>
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
   * @deprecated Use `clean: { urls: true }` or `clean: true` instead.
   */
  cleanUrls?: boolean
  /**
   * Clean up the markdown output. Pass `true` for all cleanup or an object
   * to enable specific features. `clean.urls` is handled during conversion;
   * other options are post-processing steps (sync API only).
   */
  clean?: boolean | CleanOptions
  /** Enable minimal preset (frontmatter, isolateMain, tailwind, filter). Default: false */
  minimal?: boolean
  /** Extract frontmatter from HTML head. Default when minimal: true */
  frontmatter?: boolean | { additionalFields?: Record<string, string>, metaFields?: string[] }
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

const MINIMAL_FILTER_EXCLUDE = ['form', 'fieldset', 'object', 'embed', 'footer', 'aside', 'iframe', 'input', 'textarea', 'select', 'button', 'nav']

const CLEAN_ALL: CleanOptions = { urls: true, fragments: true, emptyLinks: true, redundantLinks: true, selfLinkHeadings: true, emptyImages: true, emptyLinkText: true }

function resolveCleanConfig(options: Partial<MdreamOptions>, minimal: boolean): { cleanUrls: boolean, clean?: CleanOptions } {
  let cleanOpt = options.clean
  // Default clean: true when minimal is on, unless explicitly set to false
  if (cleanOpt === undefined && minimal)
    cleanOpt = true
  if (!cleanOpt)
    return { cleanUrls: options.cleanUrls || false }
  const resolved = cleanOpt === true ? CLEAN_ALL : cleanOpt
  return {
    cleanUrls: options.cleanUrls || resolved.urls || false,
    clean: resolved,
  }
}

function resolveOptions(options: Partial<MdreamOptions>): { napiOpts: HtmlToMarkdownOptions, extractionHandlers?: Record<string, (el: ExtractedElement) => void> } {
  const minimal = options.minimal === true
  const plugins: PluginOptions = {}

  if (minimal) {
    if (options.frontmatter !== false)
      plugins.frontmatter = typeof options.frontmatter === 'object' ? options.frontmatter : {}
    if (options.isolateMain !== false)
      plugins.isolateMain = true
    if (options.tailwind !== false)
      plugins.tailwind = true
    plugins.filter = options.filter || { exclude: MINIMAL_FILTER_EXCLUDE }
  }
  else {
    if (options.frontmatter)
      plugins.frontmatter = typeof options.frontmatter === 'object' ? options.frontmatter : {}
    if (options.isolateMain)
      plugins.isolateMain = true
    if (options.tailwind)
      plugins.tailwind = true
    if (options.filter)
      plugins.filter = options.filter
  }

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
  }
}

export function htmlToMarkdown(html: string, options: Partial<MdreamOptions> = {}): MdreamResult {
  const { napiOpts, extractionHandlers } = resolveOptions(options)
  const napiResult = _htmlToMarkdown(html, napiOpts)
  const result: MdreamResult = { markdown: napiResult.markdown }
  if (napiResult.frontmatter)
    result.frontmatter = napiResult.frontmatter
  if (napiResult.extracted?.length) {
    result.extracted = napiResult.extracted
    if (extractionHandlers) {
      for (const el of napiResult.extracted)
        extractionHandlers[el.selector]?.(el)
    }
  }
  return result
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
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done)
        break
      const processed = typeof value === 'string'
        ? stream.processChunk(value)
        : stream.processChunkBytes(value)
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
