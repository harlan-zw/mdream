import type { EngineOptions, MdreamOptions } from '@mdream/js'
import type { MdreamOptions as RustMdreamOptions } from '../../src'
import { htmlToMarkdown as jsHtmlToMarkdown, streamHtmlToMarkdown as jsStreamHtmlToMarkdown } from '@mdream/js'
import { htmlToMarkdown as _rustHtmlToMarkdown, streamHtmlToMarkdown as _rustStreamHtmlToMarkdown } from '../../src'

// Reverse map: TAG_* integer → tag name string (for Rust engine compatibility)
const TAG_ID_TO_NAME: string[] = [
  'html',
  'head',
  'details',
  'summary',
  'title',
  'meta',
  'br',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'hr',
  'strong',
  'b',
  'em',
  'i',
  'del',
  'sub',
  'sup',
  'ins',
  'blockquote',
  'code',
  'ul',
  'li',
  'a',
  'img',
  'table',
  'thead',
  'tr',
  'th',
  'td',
  'ol',
  'pre',
  'p',
  'div',
  'span',
  'tbody',
  'tfoot',
  'form',
  'nav',
  'label',
  'button',
  'body',
  'center',
  'kbd',
  'footer',
  'path',
  'svg',
  'article',
  'section',
  'script',
  'style',
  'link',
  'area',
  'base',
  'col',
  'embed',
  'input',
  'keygen',
  'param',
  'source',
  'track',
  'wbr',
  'select',
  'textarea',
  'option',
  'fieldset',
  'legend',
  'audio',
  'video',
  'canvas',
  'iframe',
  'map',
  'dialog',
  'meter',
  'progress',
  'template',
  'abbr',
  'mark',
  'q',
  'samp',
  'small',
  'noscript',
  'noframes',
  'xmp',
  'plaintext',
  'aside',
  'u',
  'cite',
  'dfn',
  'var',
  'time',
  'bdo',
  'ruby',
  'rt',
  'rp',
  'dd',
  'dt',
  'address',
  'dl',
  'figure',
  'object',
  'main',
  'header',
  'figcaption',
  'caption',
]

function convertFilterForRust(filter: any): RustMdreamOptions['filter'] {
  const result: any = {}
  if (filter.exclude) {
    result.exclude = filter.exclude.map((v: number | string) =>
      typeof v === 'number' ? (TAG_ID_TO_NAME[v] || String(v)) : v,
    )
  }
  if (filter.include) {
    result.include = filter.include.map((v: number | string) =>
      typeof v === 'number' ? (TAG_ID_TO_NAME[v] || String(v)) : v,
    )
  }
  if (filter.processChildren != null)
    result.processChildren = filter.processChildren
  return result
}

// Convert EngineOptions (plugins-based) to flat RustMdreamOptions
function toFlatOptions(options?: EngineOptions): Partial<RustMdreamOptions> {
  const flat: Partial<RustMdreamOptions> = { minimal: false, origin: options?.origin }
  const p = options?.plugins
  if (p) {
    if (p.frontmatter != null)
      flat.frontmatter = p.frontmatter as RustMdreamOptions['frontmatter']
    if (p.isolateMain != null)
      flat.isolateMain = p.isolateMain
    if (p.tailwind != null)
      flat.tailwind = p.tailwind
    if (p.filter != null)
      flat.filter = convertFilterForRust(p.filter)
    if (p.extraction != null)
      flat.extraction = p.extraction as RustMdreamOptions['extraction']
    if (p.tagOverrides != null)
      flat.tagOverrides = p.tagOverrides
  }
  return flat
}

function rustHtmlToMarkdown(html: string, options?: EngineOptions): string {
  const flat = toFlatOptions(options)
  if (options?.clean)
    (flat as any).clean = options.clean
  return _rustHtmlToMarkdown(html, flat)
}
function rustStreamHtmlToMarkdown(htmlStream: ReadableStream<Uint8Array | string> | null, options?: EngineOptions): AsyncIterable<string> {
  return _rustStreamHtmlToMarkdown(htmlStream, toFlatOptions(options))
}

/**
 * Engine-like object for test compatibility.
 * Mirrors the old MarkdownEngine shape so existing tests work unchanged.
 */
interface TestEngine {
  htmlToMarkdown: (html: string, options?: EngineOptions) => string
  streamHtmlToMarkdown: (htmlStream: ReadableStream<Uint8Array | string> | null, options?: EngineOptions) => AsyncIterable<string>
}

export const engines: Array<{ name: string, engine: TestEngine }> = [
  {
    name: 'JavaScript Engine',
    engine: {
      htmlToMarkdown: jsHtmlToMarkdown,
      streamHtmlToMarkdown: jsStreamHtmlToMarkdown,
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
export function htmlToMarkdown(html: string, options: { engine?: TestEngine } & Partial<MdreamOptions> = {}): string {
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
  options: { engine?: TestEngine } & Partial<MdreamOptions> = {},
): AsyncIterable<string> {
  const { engine, ...rest } = options
  if (!engine)
    throw new Error('engine required in test streamHtmlToMarkdown')
  return engine.streamHtmlToMarkdown(htmlStream, rest)
}
