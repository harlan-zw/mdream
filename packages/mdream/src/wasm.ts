import type { MdreamNapiResult } from '../napi/index.js'
import type { MdreamOptions } from './index.js'
import type { ResolvedOptions } from './resolve-options.js'
import {
  htmlToMarkdownBytes as _htmlToMarkdownBytes,
  htmlToMarkdownResult as _htmlToMarkdownResult,
  MarkdownStream as _MarkdownStream,
} from '../wasm/mdream_edge.js'
import { convertResult, deliverPluginData } from './convert.js'
import { resolveOptions } from './resolve-options.js'

// `mdream/wasm`: the wasm-bindgen build for manual initialization. Await the
// default export `init()` (or call `initSync()`) before converting. The
// conversion exports take `MdreamOptions`, the same as the `mdream` entry.
export * from '../wasm/mdream_edge.js'
export { default } from '../wasm/mdream_edge.js'

export function htmlToMarkdownResult(html: string, options: Partial<MdreamOptions> = {}): MdreamNapiResult {
  return convertResult(_htmlToMarkdownResult, html, options)
}

export function htmlToMarkdown(html: string, options: Partial<MdreamOptions> = {}): string {
  return htmlToMarkdownResult(html, options).markdown || ''
}

export function htmlToMarkdownBytes(html: Uint8Array, options: Partial<MdreamOptions> = {}): string {
  const resolved = resolveOptions(options)
  if (resolved.frontmatterCallback || resolved.extractionHandlers)
    return htmlToMarkdown(new TextDecoder().decode(html), options)
  return _htmlToMarkdownBytes(html, resolved.napiOpts)
}

/** Streaming converter. Runs the frontmatter and extraction callbacks in `finish()`. */
export class MarkdownStream extends _MarkdownStream {
  private _callbacks: Pick<ResolvedOptions, 'frontmatterCallback' | 'extractionHandlers'>

  constructor(options: Partial<MdreamOptions> = {}) {
    const resolved = resolveOptions(options)
    super(resolved.napiOpts)
    this._callbacks = resolved
  }

  override finish(): string {
    const markdown = super.finish()
    deliverPluginData(this.takeData(), this._callbacks)
    return markdown
  }
}
