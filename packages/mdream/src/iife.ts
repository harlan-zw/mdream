import type { HtmlToMarkdownOptions, MdreamNapiResult } from '../napi/index.js'
import { htmlToMarkdownResult as _htmlToMarkdownResult, initSync } from '../wasm/mdream_edge.js'

declare global {
  interface Window {
    mdream: {
      htmlToMarkdown: typeof htmlToMarkdown
      init: typeof init
    }
  }
}

let _ready = false

/**
 * Initialize the WASM engine. Must be called before htmlToMarkdown.
 * Accepts a URL or ArrayBuffer of the .wasm file.
 * If no argument is provided, fetches from the same directory as the script.
 */
export async function init(wasmSource?: string | URL | ArrayBuffer): Promise<void> {
  if (_ready)
    return
  if (wasmSource instanceof ArrayBuffer) {
    initSync(wasmSource)
    _ready = true
    return
  }
  const url = wasmSource
    || new URL('mdream_edge_bg.wasm', (document.currentScript as HTMLScriptElement)?.src || location.href)
  const response = await fetch(url)
  const bytes = await response.arrayBuffer()
  initSync(bytes)
  _ready = true
}

export function htmlToMarkdown(html: string, options?: HtmlToMarkdownOptions): MdreamNapiResult {
  if (!_ready)
    throw new Error('mdream: call await mdream.init() before htmlToMarkdown()')
  return _htmlToMarkdownResult(html, options || {})
}

const mdream = { htmlToMarkdown, init }

if (typeof window !== 'undefined') {
  window.mdream = mdream
}

export default mdream
