import type { HtmlToMarkdownOptions } from '../napi/index.js'
import { htmlToMarkdownResult as _htmlToMarkdownResult, MarkdownStream as _MarkdownStream, initSync } from '../wasm/mdream_edge.js'
import wasmModule from '../wasm/mdream_edge_bg.wasm'

// Edge runtimes (workerd, edge-light) resolve `.wasm` imports to a compiled
// WebAssembly.Module that must be instantiated manually (#119).
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

export async function* streamHtmlToMarkdown(
  htmlStream: ReadableStream<Uint8Array | string> | null,
  options?: HtmlToMarkdownOptions,
): AsyncIterable<string> {
  if (!htmlStream)
    throw new Error('Invalid HTML stream provided')
  const stream = new _MarkdownStream(options || {})
  const reader = htmlStream.getReader()
  const decoder = new TextDecoder()
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done)
        break
      const chunk = typeof value === 'string'
        ? decoder.decode() + value
        : decoder.decode(value, { stream: true })
      const processed = stream.processChunk(chunk)
      if (processed)
        yield processed
    }
    const decoderTail = decoder.decode()
    if (decoderTail) {
      const processed = stream.processChunk(decoderTail)
      if (processed)
        yield processed
    }
    const final_ = stream.finish()
    if (final_)
      yield final_
  }
  finally {
    reader.releaseLock()
  }
}
