import type { HtmlToMarkdownOptions } from '../../packages/mdream/index.js'
// @ts-expect-error - NAPI generated CJS
import nativeBinding from '../../packages/mdream/index.js'

const { htmlToMarkdown: _htmlToMarkdown, MarkdownStream: _MarkdownStream } = nativeBinding

export function htmlToMarkdown(html: string, options?: HtmlToMarkdownOptions | null): string {
  const result = _htmlToMarkdown(html, options)
  return result.markdown
}

export async function* streamHtmlToMarkdown(
  htmlStream: ReadableStream | null,
  options?: HtmlToMarkdownOptions | null,
): AsyncGenerator<string> {
  if (!htmlStream) {
    throw new Error('Invalid HTML stream provided')
  }

  const stream = new _MarkdownStream(options)
  const reader = htmlStream.getReader()
  const decoder = new TextDecoder()

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done)
        break

      const chunk = typeof value === 'string' ? value : decoder.decode(value, { stream: true })
      const result = stream.processChunk(chunk)
      if (result)
        yield result
    }

    const final = stream.finish()
    if (final)
      yield final
  }
  finally {
    reader.releaseLock()
  }
}
