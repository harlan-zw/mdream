import type { HtmlToMarkdownOptions } from '../napi/index.js'
import { htmlToMarkdownResult as _htmlToMarkdownResult, MarkdownStream as _MarkdownStream, initSync } from '../wasm/mdream_edge.js'
import wasmModule from '../wasm/mdream_edge_bg.wasm'
import { resolveOptions } from './resolve-options.js'
import { wasmPanicError } from './wasm-panic.js'

// Edge runtimes (workerd, edge-light) resolve `.wasm` imports to a compiled
// WebAssembly.Module that must be instantiated manually (#119).
initSync({ module: wasmModule })

function convert(html: string, napiOpts: HtmlToMarkdownOptions | undefined) {
  try {
    return _htmlToMarkdownResult(html, napiOpts)
  }
  catch (error) {
    // A Rust panic aborts the WASM instance; surface its message (#195).
    throw wasmPanicError(error)
  }
}

export function htmlToMarkdown(html: string, options?: HtmlToMarkdownOptions): string {
  if (!options)
    return convert(html, undefined).markdown || ''

  const { napiOpts, extractionHandlers, frontmatterCallback } = resolveOptions(options)
  const result = convert(html, napiOpts)
  if (result.frontmatter && frontmatterCallback)
    frontmatterCallback(result.frontmatter)
  if (result.extracted?.length && extractionHandlers) {
    for (const element of result.extracted)
      extractionHandlers[element.selector]?.(element)
  }
  return result.markdown || ''
}

export class MarkdownStream {
  private _inner: _MarkdownStream

  constructor(options?: HtmlToMarkdownOptions) {
    try {
      this._inner = new _MarkdownStream(options)
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

  finish(): string {
    try {
      return this._inner.finish()
    }
    catch (error) {
      throw wasmPanicError(error)
    }
  }
}

export async function* streamHtmlToMarkdown(
  htmlStream: ReadableStream<Uint8Array | string> | null,
  options?: HtmlToMarkdownOptions,
): AsyncIterable<string> {
  if (!htmlStream)
    throw new Error('Invalid HTML stream provided')
  // the raw binding, wrapped once below rather than once per chunk
  const stream = new _MarkdownStream(options ? resolveOptions(options).napiOpts : undefined)
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
  catch (error) {
    throw wasmPanicError(error)
  }
  finally {
    reader.releaseLock()
  }
}
