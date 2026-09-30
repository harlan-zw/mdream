import { htmlToMarkdown as _htmlToMarkdown, MarkdownStream as _MarkdownStream } from '../napi/index.mjs'
import { convertResult, pumpStream } from './convert.js'
import { resolveOptions } from './resolve-options.js'
import { createSurrogateCarry } from './surrogate-carry.js'

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
   * to enable specific features. Both `htmlToMarkdown` and
   * `streamHtmlToMarkdown` apply it.
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
  /**
   * Filter elements by CSS selector. `minimal` excludes form, nav, footer, and
   * similar; a filter passed with `minimal` adds to those excludes. `false`
   * turns filtering off, including the `minimal` one.
   */
  filter?: false | { include?: string[], exclude?: string[], processChildren?: boolean }
  /** Extract elements matching CSS selectors */
  extraction?: Record<string, (element: ExtractedElement) => void>
  /** Tag overrides. String values act as aliases */
  tagOverrides?: Record<string, TagOverride | string>
  /**
   * Hard-wrap prose at this many characters, breaking on word boundaries.
   * Applied inline during conversion (zero-cost when unset). Code blocks,
   * tables, and headings are never wrapped. `0` disables wrapping.
   */
  wrapWidth?: number
  /**
   * Output format. Defaults to `markdown`; use `text` for readable plain text,
   * or `html` for allowlisted semantic HTML.
   */
  format?: 'markdown' | 'text' | 'html'
}

export function htmlToMarkdown(html: string, options: Partial<MdreamOptions> = {}): string {
  return convertResult(_htmlToMarkdown, html, options).markdown
}

export async function* streamHtmlToMarkdown(
  htmlStream: ReadableStream<Uint8Array | string> | null,
  options: Partial<MdreamOptions> = {},
): AsyncIterable<string> {
  if (!htmlStream)
    throw new Error('Invalid HTML stream provided')
  const resolved = resolveOptions(options)
  const carry = createSurrogateCarry()
  const stream = new _MarkdownStream(resolved.napiOpts)
  yield* pumpStream({
    processChunk: chunk => stream.processChunk(carry.take(chunk)),
    processChunkBytes: chunk => stream.processChunkBytes(chunk),
    finish: () => {
      const held = carry.flush()
      return held ? stream.processChunk(held) + stream.finish() : stream.finish()
    },
    takeData: () => stream.takeData(),
  }, htmlStream, resolved, { decodeInJs: true })
}
