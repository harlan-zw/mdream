import type { HtmlToMarkdownOptions, MdreamNapiResult } from '../napi/index.js'
import init, { htmlToMarkdownResult as _htmlToMarkdownResult, MarkdownStream as _MarkdownStream } from '../wasm/mdream_edge.js'

let _initPromise: Promise<unknown> | null = null

function ensureInit(): Promise<unknown> {
  if (!_initPromise) {
    _initPromise = init()
  }
  return _initPromise
}

// Eagerly start WASM initialization
ensureInit()

export async function htmlToMarkdown(html: string, options?: HtmlToMarkdownOptions): Promise<MdreamNapiResult> {
  await ensureInit()
  return _htmlToMarkdownResult(html, options || {})
}

export async function createMarkdownStream(options?: HtmlToMarkdownOptions): Promise<MarkdownStream> {
  await ensureInit()
  return new MarkdownStream(options)
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
