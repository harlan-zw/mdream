import type { MarkdownOptions } from './resolve-markdown-options.js'
import { __mdreamTakePanicMessage, htmlToMarkdownResult, MarkdownStream as WasmStream } from '../wasm-bundler/mdream_markdown.js'
import { resolveMarkdownOptions } from './resolve-markdown-options.js'
import { convertWasmHtml, pumpWasmStream, WasmMarkdownStream } from './wasm-converter.js'

export type { MarkdownOptions as MdreamOptions } from './resolve-markdown-options.js'

const bindings = { oneShot: htmlToMarkdownResult, Stream: WasmStream, takePanicMessage: __mdreamTakePanicMessage }

export function htmlToMarkdown(html: string, options: MarkdownOptions = {}): string {
  return convertWasmHtml(html, bindings, resolveMarkdownOptions(options))
}

export class MarkdownStream extends WasmMarkdownStream {
  constructor(options: MarkdownOptions = {}) {
    super(bindings, resolveMarkdownOptions(options))
  }
}

export async function* streamHtmlToMarkdown(
  htmlStream: ReadableStream<Uint8Array | string> | null,
  options: MarkdownOptions = {},
): AsyncIterable<string> {
  if (!htmlStream)
    throw new Error('Invalid HTML stream provided')
  yield* pumpWasmStream(htmlStream, bindings, resolveMarkdownOptions(options))
}
