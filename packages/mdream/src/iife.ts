import type { HtmlToMarkdownOptions, MdreamNapiResult } from '../napi/index.js'
import type { MdreamOptions } from './index.js'
import { htmlToMarkdownResult as _htmlToMarkdownResult } from '../wasm/mdream_edge.js'
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
    throw wasmPanicError(error)
  }
}

export function htmlToMarkdown(html: string, options: Partial<MdreamOptions> = {}): MdreamNapiResult {
  return convertResult(convert, html, options)
}

if (typeof window !== 'undefined')
  window.mdream = { htmlToMarkdown }
