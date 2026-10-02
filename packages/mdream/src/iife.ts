import type { HtmlToMarkdownOptions, MdreamNapiResult } from '../napi/index.js'
import type { MdreamOptions } from './index.js'
import { __mdreamTakePanicMessage, htmlToMarkdownResult as _htmlToMarkdownResult } from '../wasm/mdream_edge.js'
import { convertResult } from './convert.js'
import { wasmPanicError } from './wasm-panic.js'

// The CDN build (`dist/iife.js`). build.config.ts wraps this module with the
// wasm-bindgen runtime and an inlined WASM binary, initialized before this
// code runs, so `window.mdream` is ready at load.

declare global {
  interface Window {
    mdream: {
      htmlToMarkdown: typeof htmlToMarkdown
    }
  }
}

function convert(html: string, napiOpts: HtmlToMarkdownOptions): MdreamNapiResult {
  try {
    return _htmlToMarkdownResult(html, napiOpts)
  }
  catch (error) {
    throw wasmPanicError(error, __mdreamTakePanicMessage)
  }
}

/**
 * Returns a Promise, the same as the `browser` entry, so code moves between the
 * CDN script and a bundle unchanged. The inlined binary is ready at load.
 */
export async function htmlToMarkdown(html: string, options: Partial<MdreamOptions> = {}): Promise<string> {
  return convertResult(convert, html, options).markdown || ''
}

if (typeof window !== 'undefined')
  window.mdream = { htmlToMarkdown }
