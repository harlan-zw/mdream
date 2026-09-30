import type { HtmlToMarkdownOptions, MdreamNapiResult } from '../napi/index.js'
import type { MdreamOptions } from './index.js'
import type { ResolvedOptions } from './resolve-options.js'
import init, { __mdreamTakePanicMessage, htmlToMarkdownResult as _htmlToMarkdownResult, MarkdownStream as _MarkdownStream } from '../wasm/mdream_edge.js'
import { convertResult, deliverPluginData, pumpStream } from './convert.js'
import { resolveOptions } from './resolve-options.js'
import { createSurrogateCarry } from './surrogate-carry.js'
import { wasmPanicError } from './wasm-panic.js'

export type { CleanOptions, ExtractedElement, FrontmatterConfig, MdreamOptions, TagOverride } from './index.js'

let _initPromise: Promise<unknown>

function ensureInit(): Promise<unknown> {
  if (!_initPromise) {
    _initPromise = init()
  }
  return _initPromise
}

// Eagerly start WASM initialization
ensureInit()

function convert(html: string, napiOpts: HtmlToMarkdownOptions): MdreamNapiResult {
  try {
    return _htmlToMarkdownResult(html, napiOpts)
  }
  catch (error) {
    // A Rust panic aborts the WASM instance; surface its message (#195).
    throw wasmPanicError(error, __mdreamTakePanicMessage)
  }
}

/**
 * Browser builds fetch the WASM binary on first use, so this returns a
 * Promise. The `browser` export condition ships types that say so.
 */
export async function htmlToMarkdown(html: string, options: Partial<MdreamOptions> = {}): Promise<string> {
  await ensureInit()
  return convertResult(convert, html, options).markdown || ''
}

export async function createMarkdownStream(options?: Partial<MdreamOptions>): Promise<MarkdownStream> {
  await ensureInit()
  return new MarkdownStream(options)
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
      throw wasmPanicError(error, __mdreamTakePanicMessage)
    }
  }

  processChunk(chunk: string): string {
    try {
      return this._inner.processChunk(this._carry.take(chunk))
    }
    catch (error) {
      throw wasmPanicError(error, __mdreamTakePanicMessage)
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
      throw wasmPanicError(error, __mdreamTakePanicMessage)
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
      throw wasmPanicError(error, __mdreamTakePanicMessage)
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
  await ensureInit()
  const resolved = resolveOptions(options)
  const carry = createSurrogateCarry()
  // the raw binding, wrapped once in pumpStream rather than once per chunk
  let stream: _MarkdownStream
  try {
    stream = new _MarkdownStream(resolved.napiOpts)
  }
  catch (error) {
    throw wasmPanicError(error, __mdreamTakePanicMessage)
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
  }, htmlStream, resolved, { mapError: error => wasmPanicError(error, __mdreamTakePanicMessage) })
}
