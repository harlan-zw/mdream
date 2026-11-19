import type { HtmlToMarkdownOptions, MdreamNapiResult } from '../napi/index.js'
import type { MdreamOptions } from './index.js'
import type { EncodedWasm } from './wasm-encoding.js'
import { __mdreamTakePanicMessage, htmlToMarkdownResult as _htmlToMarkdownResult, MarkdownStream as _MarkdownStream, initSync } from '../wasm/mdream_edge.js'
import { convertResult, convertWasm } from './convert.js'
import { decodeWasm } from './wasm-encoding.js'
import { wasmPanicError } from './wasm-panic.js'

// The CDN build (`dist/iife.js`). build.config.ts bundles this module as an
// IIFE and embeds the WASM binary, so
// `window.mdream` is ready at load.

declare const __MDREAM_WASM__: EncodedWasm

declare global {
  interface Window {
    mdream: {
      htmlToMarkdown: typeof htmlToMarkdown
    }
  }
}

const engine = { oneShot: _htmlToMarkdownResult, Stream: _MarkdownStream }

function convert(html: string, napiOpts: HtmlToMarkdownOptions): MdreamNapiResult {
  try {
    return convertWasm(html, napiOpts, engine)
  }
  catch (error) {
    throw wasmPanicError(error, __mdreamTakePanicMessage)
  }
}

/**
 * Returns a Promise, the same as the `browser` entry, so code moves between the
 * CDN script and a bundle unchanged. The inlined binary is ready at load.
 */
async function htmlToMarkdown(html: string, options: Partial<MdreamOptions> = {}): Promise<string> {
  return convertResult(convert, html, options).markdown || ''
}

if (typeof window !== 'undefined') {
  // If the WASM fails to instantiate, this throws and `window.mdream` stays unset.
  initSync({ module: decodeWasm(__MDREAM_WASM__) })
  window.mdream = { htmlToMarkdown }
}
