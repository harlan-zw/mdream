import type { HtmlToMarkdownOptions } from '../napi/index.js'
import { htmlToMarkdownResult as _htmlToMarkdownResult, MarkdownStream as _MarkdownStream, initSync } from '../wasm/mdream_edge.js'
import wasmModule from '../wasm/mdream_edge_bg.wasm'

initSync({ module: wasmModule })

export function htmlToMarkdown(html: string, options?: HtmlToMarkdownOptions): string {
  const result = _htmlToMarkdownResult(html, options || {})
  return result.markdown || ''
}

export class MarkdownStream {
  private _inner: _MarkdownStream

  constructor(options?: HtmlToMarkdownOptions) {
    this._inner = new _MarkdownStream(options || {})
  }

  processChunk(chunk: string): string {
    return this._inner.processChunk(chunk)
  }

  finish(): string {
    return this._inner.finish()
  }
}
