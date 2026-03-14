// Edge runtime entry point (Cloudflare Workers, Vercel Edge, etc.)
// Uses wasm-bindgen (wasm32-unknown-unknown) — no SharedArrayBuffer needed
import { initSync, htmlToMarkdown as _htmlToMarkdown, htmlToMarkdownResult as _htmlToMarkdownResult, MarkdownStream as _MarkdownStream } from './wasm/mdream_edge.js'
import wasmModule from './wasm/mdream_edge_bg.wasm'

initSync({ module: wasmModule })

export function htmlToMarkdown(html, options) {
  const result = _htmlToMarkdownResult(html, options || {})
  return {
    markdown: result.markdown || '',
    extracted: result.extracted || null,
    frontmatter: result.frontmatter || null,
  }
}

export class MarkdownStream {
  constructor(options) {
    this._inner = new _MarkdownStream(options || {})
  }

  processChunk(chunk) {
    return this._inner.processChunk(chunk)
  }

  finish() {
    return this._inner.finish()
  }
}
