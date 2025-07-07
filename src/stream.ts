import type { ReadableStream } from 'node:stream/web'
import type { ParseState } from './parse'
import type { HTMLToMarkdownOptions } from './types'
import { createMarkdownProcessor } from './markdown-processor.ts'
import { parseHtmlStream } from './parse.ts'
import { processPluginsForEvent } from './plugin-processor.ts'

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
        processPluginsForEvent(event, options.plugins, processor.state, processor.processEvent)
      })

      const chunk = processor.getMarkdownChunk()
      if (chunk) {
        yield chunk
      }
    }
    // Process any remaining HTML and emit final chunk
    if (remainingHtml) {
      parseHtmlStream(remainingHtml, parseState, (event) => {
        processPluginsForEvent(event, options.plugins, processor.state, processor.processEvent)
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
