import type { HtmlToMarkdownOptions } from '../napi/index.js'
import type { MdreamOptions } from './index.js'
import type { ResolvedOptions } from './resolve-options.js'
import { htmlToMarkdownResult as _htmlToMarkdownResult, MarkdownStream as _MarkdownStream, initSync } from '../wasm/mdream_edge.js'
import wasmModule from '../wasm/mdream_edge_bg.wasm'
import { convertResult, deliverPluginData, pumpStream } from './convert.js'
import { resolveOptions } from './resolve-options.js'
import { createSurrogateCarry } from './surrogate-carry.js'
import { wasmPanicError } from './wasm-panic.js'

// Edge runtimes (workerd, edge-light) resolve `.wasm` imports to a compiled
// WebAssembly.Module that must be instantiated manually (#119).
initSync({ module: wasmModule })

function convert(html: string, napiOpts: HtmlToMarkdownOptions) {
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
  private _carry = createSurrogateCarry()
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
      return this._inner.processChunk(this._carry.take(chunk))
    }
    catch (error) {
      throw wasmPanicError(error)
    }
  }

  processChunkBytes(chunk: Uint8Array): string {
    try {
      const held = this._carry.flush()
      return held
        ? this._inner.processChunk(held) + this._inner.processChunkBytes(chunk)
        : this._inner.processChunkBytes(chunk)
    }
    catch (error) {
      throw wasmPanicError(error)
    }
  }

  finish(): string {
    let markdown: string
    try {
      const held = this._carry.flush()
      markdown = held
        ? this._inner.processChunk(held) + this._inner.finish()
        : this._inner.finish()
    }
    catch (error) {
      throw wasmPanicError(error)
    }
    if (this._callbacks.frontmatterCallback || this._callbacks.extractionHandlers)
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
  const carry = createSurrogateCarry()
  // the raw binding, wrapped once in pumpStream rather than once per chunk
  let stream: _MarkdownStream
  try {
    stream = new _MarkdownStream(resolved.napiOpts)
  }
  catch (error) {
    throw wasmPanicError(error)
  }
  yield* pumpStream({
    processChunk: chunk => stream.processChunk(carry.take(chunk)),
    processChunkBytes: (chunk) => {
      const held = carry.flush()
      return held
        ? stream.processChunk(held) + stream.processChunkBytes(chunk)
        : stream.processChunkBytes(chunk)
    },
    finish: () => {
      const held = carry.flush()
      return held ? stream.processChunk(held) + stream.finish() : stream.finish()
    },
    takeData: () => stream.takeData(),
  }, htmlStream, resolved, { mapError: wasmPanicError })
}
