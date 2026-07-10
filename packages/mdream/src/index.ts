import type { MdreamOptions } from './resolve-options.js'
import { htmlToMarkdown as _htmlToMarkdown, MarkdownStream as _MarkdownStream } from '../napi/index.mjs'
import { assertNoHookPlugins, resolveOptions } from './resolve-options.js'

export type {
  CleanOptions,
  ExtractedElement,
  FrontmatterConfig,
  MdreamOptions,
  TagOverride,
} from './resolve-options.js'

export function htmlToMarkdown(html: string, options: Partial<MdreamOptions> = {}): string {
  assertNoHookPlugins(options)
  const { napiOpts, extractionHandlers, frontmatterCallback } = resolveOptions(options)
  const napiResult = _htmlToMarkdown(html, napiOpts)
  if (napiResult.frontmatter && frontmatterCallback)
    frontmatterCallback(napiResult.frontmatter)
  if (napiResult.extracted?.length && extractionHandlers) {
    for (const el of napiResult.extracted)
      extractionHandlers[el.selector]?.(el)
  }
  return napiResult.markdown
}

export async function* streamHtmlToMarkdown(
  htmlStream: ReadableStream<Uint8Array | string> | null,
  options: Partial<MdreamOptions> = {},
): AsyncIterable<string> {
  if (!htmlStream)
    throw new Error('Invalid HTML stream provided')
  const { napiOpts } = resolveOptions(options)
  const stream = new _MarkdownStream(napiOpts)
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
