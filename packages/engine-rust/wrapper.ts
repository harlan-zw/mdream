import type { ReadableStream } from 'node:stream/web'
import type { EngineOptions } from '@mdream/engine-js'
import type { HtmlToMarkdownOptions } from './index.js'
import { htmlToMarkdown, MarkdownStream } from './index.js'

export type { MarkdownEngine } from '@mdream/engine-js'

export { htmlToMarkdown, MarkdownStream }

export async function* streamHtmlToMarkdown(
  htmlStream: ReadableStream<Uint8Array | string> | null,
  options: EngineOptions = {},
): AsyncIterable<string> {
  if (!htmlStream) {
    throw new Error('Invalid HTML stream provided')
  }

  const decoder = new TextDecoder()
  const reader = htmlStream.getReader()
  const stream = new MarkdownStream(options as HtmlToMarkdownOptions)

  try {
    while (true) {
      const { done, value } = await reader.read()

      if (done) {
        break
      }

      const htmlContent = typeof value === 'string' ? value : decoder.decode(value, { stream: true })
      const chunk = stream.processChunk(htmlContent)
      if (chunk) {
        yield chunk
      }
    }

    const finalChunk = stream.finish()
    if (finalChunk) {
      yield finalChunk
    }
  }
  finally {
    reader.releaseLock()
  }
}

export function createRustEngine() {
  return {
    htmlToMarkdown,
    streamHtmlToMarkdown,
  }
}
