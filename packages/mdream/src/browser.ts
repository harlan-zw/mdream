import type { MdreamOptions } from './index.js'
import init, { __mdreamTakePanicMessage, htmlToMarkdownResult, MarkdownStream as WasmStream } from '../wasm/mdream_edge.js'
import { resolveOptions } from './resolve-options.js'
import { convertWasmHtml, pumpWasmStream, WasmMarkdownStream } from './wasm-converter.js'

export type { CleanOptions, ExtractedElement, FrontmatterConfig, MdreamOptions, TagOverride } from './index.js'

const bindings = { oneShot: htmlToMarkdownResult, Stream: WasmStream, takePanicMessage: __mdreamTakePanicMessage }
const ready = init()

export async function htmlToMarkdown(html: string, options: Partial<MdreamOptions> = {}): Promise<string> {
  await ready
  return convertWasmHtml(html, bindings, resolveOptions(options))
}

export async function createMarkdownStream(options?: Partial<MdreamOptions>): Promise<MarkdownStream> {
  await ready
  return new MarkdownStream(options)
}

export class MarkdownStream extends WasmMarkdownStream {
  constructor(options: Partial<MdreamOptions> = {}) {
    super(bindings, resolveOptions(options))
  }
}

export async function* streamHtmlToMarkdown(
  htmlStream: ReadableStream<Uint8Array | string> | null,
  options: Partial<MdreamOptions> = {},
): AsyncIterable<string> {
  if (!htmlStream)
    throw new Error('Invalid HTML stream provided')
  await ready
  yield* pumpWasmStream(htmlStream, bindings, resolveOptions(options))
}
