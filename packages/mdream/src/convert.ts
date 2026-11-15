import type { HtmlToMarkdownOptions, MdreamNapiResult } from '../napi/index.js'
import type { ExtractedElement, MdreamOptions } from './index.js'
import type { ResolvedOptions } from './resolve-options.js'
import { resolveOptions } from './resolve-options.js'

/**
 * The shared conversion path. Every entry point (Node, edge, browser, Web
 * Worker, raw WASM, CDN) passes its engine binding here, so `minimal`,
 * `frontmatter`, `filter`, `extraction`, and `tagOverrides` mean the same
 * thing everywhere.
 */

export interface PluginData {
  frontmatter?: Record<string, string>
  extracted?: ExtractedElement[]
}

type Callbacks = Pick<ResolvedOptions, 'frontmatterCallback' | 'extractionHandlers'>

export interface EngineStream {
  processChunk: (chunk: string) => string
  /** Takes raw UTF-8 bytes. If absent, `pumpStream` decodes bytes with `TextDecoder` and calls `processChunk`. */
  processChunkBytes?: (chunk: Uint8Array) => string
  finish: () => string
  takeData: () => PluginData
}

/** Calls the frontmatter callback and extraction handlers with what a conversion collected. */
export function deliverPluginData(data: PluginData, { frontmatterCallback, extractionHandlers }: Callbacks): void {
  if (data.frontmatter && frontmatterCallback)
    frontmatterCallback(data.frontmatter)
  if (data.extracted?.length && extractionHandlers) {
    for (const element of data.extracted)
      extractionHandlers[element.selector]?.(element)
  }
}

function hasCallbacks({ frontmatterCallback, extractionHandlers }: Callbacks): boolean {
  return !!frontmatterCallback || !!extractionHandlers
}

const utf8 = new TextEncoder()

/**
 * Input bytes a WASM conversion passes in per call. On a fresh instance,
 * 16 KiB grew linear memory by about half as much as 64 KiB per large page,
 * at a time cost within measurement noise; smaller chunks were slower.
 */
const WASM_CHUNK_BYTES = 16 * 1024
const WASM_CHUNK_CODE_UNITS = 16 * 1024
const MAX_SINGLE_CHUNK_CODE_UNITS = Math.floor(WASM_CHUNK_BYTES / 3)

export interface WasmStream {
  processChunk: (chunk: string) => string
  processChunkBytes: (chunk: Uint8Array) => string
  finish: () => string
  takeData: () => Omit<MdreamNapiResult, 'markdown'>
  free: () => void
}

/**
 * One-shot conversion on a WASM engine, through a stream. WASM memory never
 * shrinks, so it holds one chunk of UTF-8 input and the undrained output,
 * not the whole input and output; a string argument would also be copied in
 * at three bytes per UTF-16 unit once it holds non-ASCII text. A stream joins
 * to the same output as one-shot conversion.
 */
export function convertWasm(
  html: string,
  napiOpts: HtmlToMarkdownOptions,
  Stream: new (napiOpts: HtmlToMarkdownOptions) => WasmStream,
): MdreamNapiResult {
  const stream = new Stream(napiOpts)
  try {
    let markdown = ''
    // Byte chunks drop a leading BOM as `TextDecoder` does; string input keeps it.
    if (html.charCodeAt(0) === 0xFEFF) {
      markdown += stream.processChunk(String.fromCharCode(0xFEFF))
      html = html.slice(1)
    }
    if (html.length <= MAX_SINGLE_CHUNK_CODE_UNITS) {
      const bytes = utf8.encode(html)
      if (bytes.length)
        markdown += stream.processChunkBytes(bytes)
    }
    else {
      const bytes = new Uint8Array(WASM_CHUNK_BYTES)
      let start = 0

      while (start < html.length) {
        let end = Math.min(start + WASM_CHUNK_CODE_UNITS, html.length)
        if (end < html.length) {
          const lastCodeUnit = html.charCodeAt(end - 1)
          const nextCodeUnit = html.charCodeAt(end)
          if (lastCodeUnit >= 0xD800 && lastCodeUnit <= 0xDBFF && nextCodeUnit >= 0xDC00 && nextCodeUnit <= 0xDFFF)
            end--
        }

        const { read, written } = utf8.encodeInto(html.slice(start, end), bytes)
        markdown += stream.processChunkBytes(bytes.subarray(0, written))
        start += read
      }
    }
    markdown += stream.finish()
    return { ...stream.takeData(), markdown }
  }
  finally {
    // After a panic the instance has aborted; the panic is the error to report.
    try {
      stream.free()
    }
    catch {}
  }
}

/** Resolves `options`, converts with the engine binding, and runs the callbacks. */
export function convertResult(
  convert: (html: string, napiOpts: HtmlToMarkdownOptions) => MdreamNapiResult,
  html: string,
  options: Partial<MdreamOptions> = {},
): MdreamNapiResult {
  const resolved = resolveOptions(options)
  const result = convert(html, resolved.napiOpts)
  deliverPluginData(result, resolved)
  return result
}

export interface PumpOptions {
  /** Maps an engine error before it is thrown, for example a WASM panic. */
  mapError?: (error: unknown) => unknown
}

/**
 * Feeds `htmlStream` through an engine stream, yields the Markdown, then runs
 * the callbacks once the whole document is read.
 */
export async function* pumpStream(
  stream: EngineStream,
  htmlStream: ReadableStream<Uint8Array | string>,
  callbacks: Callbacks,
  { mapError = error => error }: PumpOptions = {},
): AsyncIterable<string> {
  const reader = htmlStream.getReader()
  const decoder = stream.processChunkBytes ? undefined : new TextDecoder()
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done)
        break
      let processed: string
      if (typeof value === 'string')
        processed = stream.processChunk(decoder ? decoder.decode() + value : value)
      else
        processed = decoder ? stream.processChunk(decoder.decode(value, { stream: true })) : stream.processChunkBytes!(value)
      if (processed)
        yield processed
    }
    const decoderTail = decoder?.decode()
    if (decoderTail) {
      const processed = stream.processChunk(decoderTail)
      if (processed)
        yield processed
    }
    const final_ = stream.finish()
    if (hasCallbacks(callbacks))
      deliverPluginData(stream.takeData(), callbacks)
    if (final_)
      yield final_
  }
  catch (error) {
    throw mapError(error)
  }
  finally {
    reader.releaseLock()
  }
}
