import type { HtmlToMarkdownOptions, MdreamNapiResult } from '../napi/index.js'
import type { MdreamOptions } from './index.js'
import { __mdreamTakePanicMessage, htmlToMarkdownResult as _htmlToMarkdownResult, initSync } from '../wasm/mdream_edge.js'
import { convertResult } from './convert.js'
import { wasmPanicError } from './wasm-panic.js'

// The CDN build (`dist/iife.js`). build.config.ts bundles this module as an
// IIFE and defines `__MDREAM_WASM_BASE64__` as the WASM binary, so
// `window.mdream` is ready at load.

declare const __MDREAM_WASM_BASE64__: string

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
async function htmlToMarkdown(html: string, options: Partial<MdreamOptions> = {}): Promise<string> {
  return convertResult(convert, html, options).markdown || ''
}

if (typeof window !== 'undefined') {
  const binary = atob(__MDREAM_WASM_BASE64__)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++)
    bytes[i] = binary.charCodeAt(i)
  // If the WASM fails to instantiate, this throws and `window.mdream` stays unset.
  initSync({ module: bytes })
  window.mdream = { htmlToMarkdown }
}
