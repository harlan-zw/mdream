import type { WasmEngine, WasmStream } from './convert.js'
import type { ResolvedOptions } from './resolve-options.js'
import { convertWasm, deliverPluginData, pumpStream } from './convert.js'
import { createSurrogateCarry } from './surrogate-carry.js'
import { wasmPanicError } from './wasm-panic.js'

interface WasmBindings extends WasmEngine {
  takePanicMessage: () => string | undefined
}

export function convertWasmHtml(html: string, bindings: WasmBindings, resolved: ResolvedOptions): string {
  let result
  try {
    result = convertWasm(html, resolved.napiOpts, bindings)
  }
  catch (error) {
    throw wasmPanicError(error, bindings.takePanicMessage)
  }
  deliverPluginData(result, resolved)
  return result.markdown || ''
}

// Keep the UTF-16 string carry and the WASM byte carry in the same order
// whether the caller supplies a ReadableStream or feeds chunks by hand.
function streamChunks(inner: WasmStream) {
  const carry = createSurrogateCarry()
  return {
    processChunk: (chunk: string) => inner.processChunk(carry.take(chunk)),
    processChunkBytes: (chunk: Uint8Array) => {
      const held = carry.flush()
      return held ? inner.processChunk(held) + inner.processChunkBytes(chunk) : inner.processChunkBytes(chunk)
    },
    finish: () => {
      const held = carry.flush()
      return held ? inner.processChunk(held) + inner.finish() : inner.finish()
    },
    takeData: () => inner.takeData(),
    free: () => inner.free(),
  }
}

function openStream(bindings: WasmBindings, { napiOpts }: ResolvedOptions): ReturnType<typeof streamChunks> {
  try {
    return streamChunks(new bindings.Stream(napiOpts))
  }
  catch (error) {
    throw wasmPanicError(error, bindings.takePanicMessage)
  }
}

export class WasmMarkdownStream {
  private readonly _chunks: ReturnType<typeof streamChunks>

  protected constructor(private readonly _bindings: WasmBindings, private readonly _callbacks: ResolvedOptions) {
    this._chunks = openStream(_bindings, _callbacks)
  }

  processChunk(chunk: string): string {
    try {
      return this._chunks.processChunk(chunk)
    }
    catch (error) {
      throw wasmPanicError(error, this._bindings.takePanicMessage)
    }
  }

  processChunkBytes(chunk: Uint8Array): string {
    try {
      return this._chunks.processChunkBytes(chunk)
    }
    catch (error) {
      throw wasmPanicError(error, this._bindings.takePanicMessage)
    }
  }

  finish(): string {
    let markdown: string
    try {
      markdown = this._chunks.finish()
    }
    catch (error) {
      throw wasmPanicError(error, this._bindings.takePanicMessage)
    }
    if (this._callbacks.frontmatterCallback || this._callbacks.extractionHandlers)
      deliverPluginData(this._chunks.takeData(), this._callbacks)
    return markdown
  }
}

export function pumpWasmStream(
  htmlStream: ReadableStream<Uint8Array | string>,
  bindings: WasmBindings,
  resolved: ResolvedOptions,
): AsyncIterable<string> {
  return pumpStream(openStream(bindings, resolved), htmlStream, resolved, {
    mapError: error => wasmPanicError(error, bindings.takePanicMessage),
  })
}
