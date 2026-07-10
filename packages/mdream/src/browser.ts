import type { MdreamNapiResult } from '../napi/index.js'
import type { MdreamOptions } from './resolve-options.js'
import init, { htmlToMarkdownResult as _htmlToMarkdownResult, MarkdownStream as _MarkdownStream } from '../wasm/mdream_edge.js'
import { assertNoHookPlugins, resolveOptions } from './resolve-options.js'

let _initPromise: Promise<unknown>

function ensureInit(): Promise<unknown> {
  if (!_initPromise) {
    _initPromise = init()
  }
  return _initPromise
}

// Eagerly start WASM initialization
ensureInit()

export async function htmlToMarkdown(html: string, options: Partial<MdreamOptions> = {}): Promise<MdreamNapiResult> {
  await ensureInit()
  assertNoHookPlugins(options)
  const { napiOpts, extractionHandlers, frontmatterCallback } = resolveOptions(options)
  const result = _htmlToMarkdownResult(html, napiOpts)
  if (result.frontmatter && frontmatterCallback)
    frontmatterCallback(result.frontmatter)
  if (result.extracted?.length && extractionHandlers) {
    for (const el of result.extracted)
      extractionHandlers[el.selector]?.(el)
  }
  return result
}

export async function createMarkdownStream(options: Partial<MdreamOptions> = {}): Promise<MarkdownStream> {
  await ensureInit()
  return new MarkdownStream(options)
}

export class MarkdownStream {
  private _inner: _MarkdownStream

  constructor(options: Partial<MdreamOptions> = {}) {
    assertNoHookPlugins(options)
    this._inner = new _MarkdownStream(resolveOptions(options).napiOpts)
  }

  processChunk(chunk: string): string {
    return this._inner.processChunk(chunk)
  }

  finish(): string {
    return this._inner.finish()
  }
}

export async function* streamHtmlToMarkdown(
  htmlStream: ReadableStream<Uint8Array | string> | null,
  options: Partial<MdreamOptions> = {},
): AsyncIterable<string> {
  if (!htmlStream)
    throw new Error('Invalid HTML stream provided')
  await ensureInit()
  const stream = new MarkdownStream(options)
  const reader = htmlStream.getReader()
  const decoder = new TextDecoder()
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done)
        break
      const chunk = typeof value === 'string' ? value : decoder.decode(value)
      const processed = stream.processChunk(chunk)
      if (processed)
        yield processed
    }
    const final_ = stream.finish()
    if (final_)
      yield final_
  }
  finally {
    reader.releaseLock()
  }
}
