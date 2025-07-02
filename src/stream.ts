import type { ReadableStream } from 'node:stream/web'
import type { HTMLToMarkdownOptions } from './types'
import { parseHtmlStream, type ParseState } from './parse'
import { createMarkdownProcessor } from './markdown-processor'

/**
 * Creates a markdown stream from an HTML stream
 * @param htmlStream - ReadableStream of HTML content (as Uint8Array or string)
 * @param options - Configuration options for conversion
 * @returns An async generator yielding markdown chunks
 */
export async function* streamHtmlToMarkdown(
  htmlStream: ReadableStream | null,
  options: HTMLToMarkdownOptions = {},
): AsyncIterable<string> {
  if (!htmlStream) {
    throw new Error('Invalid HTML stream provided')
  }
  const decoder = new TextDecoder()
  const reader = htmlStream.getReader()

  const processor = createMarkdownProcessor(options)
  const parseState: ParseState = {
    depthMap: new Uint8Array(1024),
    depth: 0,
    plugins: options.plugins || [],
  }

  let remainingHtml = ''

  try {
    while (true) {
      const { done, value } = await reader.read()

      if (done) {
        break
      }

      // Process the HTML chunk
      const htmlContent = `${remainingHtml}${typeof value === 'string' ? value : decoder.decode(value, { stream: true })}`
      
      remainingHtml = parseHtmlStream(htmlContent, parseState, (event) => {
        processor.processEvent(event)
      })

      const chunk = processor.getMarkdownChunk()
      if (chunk) {
        yield chunk
      }
    }
    // Process any remaining HTML and emit final chunk
    if (remainingHtml) {
      parseHtmlStream(remainingHtml, parseState, (event) => {
        processor.processEvent(event)
      })
    }

    // Emit any final content
    const finalChunk = processor.getMarkdownChunk()
    if (finalChunk) {
      yield finalChunk
    }
  }
  finally {
    // Ensure proper cleanup
    if (remainingHtml) {
      decoder.decode(new Uint8Array(0), { stream: false })
    }
    reader.releaseLock()
  }
}
