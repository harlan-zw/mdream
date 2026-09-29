import type { HtmlToMarkdownOptions, MdreamNapiResult } from '../napi/index.js'
import type { MdreamOptions } from './index.js'
import type { ResolvedOptions } from './resolve-options.js'
import { htmlToMarkdownResult as _htmlToMarkdownResult, MarkdownStream as _MarkdownStream, initSync } from '../wasm/mdream_edge.js'
import { convertResult, deliverPluginData, pumpStream } from './convert.js'
import { resolveOptions } from './resolve-options.js'
import { wasmBytes } from './wasm-bytes.js'
import { wasmPanicError } from './wasm-panic.js'

// The binary is inlined, so the engine is ready at import and the API matches
// the Node entry: htmlToMarkdown returns a string, not a Promise.
initSync({ module: wasmBytes() })

function convert(html: string, napiOpts: HtmlToMarkdownOptions): MdreamNapiResult {
  try {
    return _htmlToMarkdownResult(html, napiOpts)
  }
  catch (error) {
    // A Rust panic aborts the WASM instance; surface its message (#195).
    throw wasmPanicError(error)
  }
}

export function htmlToMarkdown(html: string, options: Partial<MdreamOptions> = {}): string {
  return convertResult(convert, html, options).markdown || ''
}

/** Streaming converter. Runs the frontmatter and extraction callbacks in `finish()`. */
export class MarkdownStream {
  private _inner: _MarkdownStream
  private _callbacks: Pick<ResolvedOptions, 'frontmatterCallback' | 'extractionHandlers'>

  constructor(options: Partial<MdreamOptions> = {}) {
    const resolved = resolveOptions(options)
    this._callbacks = resolved
    try {
      this._inner = new _MarkdownStream(resolved.napiOpts)
    }
    catch (error) {
      throw wasmPanicError(error)
    }
  }

  processChunk(chunk: string): string {
    try {
      return this._inner.processChunk(chunk)
    }
    catch (error) {
      throw wasmPanicError(error)
    }
  }

  processChunkBytes(chunk: Uint8Array): string {
    try {
      return this._inner.processChunkBytes(chunk)
    }
    catch (error) {
      throw wasmPanicError(error)
    }
  }

  finish(): string {
    let markdown: string
    try {
      markdown = this._inner.finish()
    }
    catch (error) {
      throw wasmPanicError(error)
    }
    deliverPluginData(this._inner.takeData(), this._callbacks)
    return markdown
  }
}

export async function* streamHtmlToMarkdown(
  htmlStream: ReadableStream<Uint8Array | string> | null,
  options: Partial<MdreamOptions> = {},
): AsyncIterable<string> {
  if (!htmlStream)
    throw new Error('Invalid HTML stream provided')
  const resolved = resolveOptions(options)
  // the raw binding, wrapped once in pumpStream rather than once per chunk
  let stream: _MarkdownStream
  try {
    stream = new _MarkdownStream(resolved.napiOpts)
  }
  catch (error) {
    throw wasmPanicError(error)
  }
  yield* pumpStream(stream, htmlStream, resolved, { mapError: wasmPanicError })
}
