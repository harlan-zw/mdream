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
  processChunkBytes: (chunk: Uint8Array) => string
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
  /** Decode bytes with `TextDecoder` and feed strings, instead of `processChunkBytes`. */
  decodeInJs?: boolean
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
  { decodeInJs = false, mapError = error => error }: PumpOptions = {},
): AsyncIterable<string> {
  const reader = htmlStream.getReader()
  const decoder = decodeInJs ? new TextDecoder() : undefined
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done)
        break
      let processed: string
      if (typeof value === 'string')
        processed = stream.processChunk(decoder ? decoder.decode() + value : value)
      else
        processed = decoder ? stream.processChunk(decoder.decode(value, { stream: true })) : stream.processChunkBytes(value)
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
