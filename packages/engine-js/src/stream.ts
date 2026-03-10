import type { ParseState } from './parse'
import type { EngineOptions, Plugin } from './types'
import { createMarkdownProcessor } from './markdown-processor'
import { parseHtmlStream } from './parse'
import { processPluginsForEvent } from './plugin-processor'

/**
 * Creates a markdown stream from an HTML stream
 * @param htmlStream - ReadableStream of HTML content (as Uint8Array or string)
 * @param options - Configuration options for conversion
 * @param resolvedPlugins - Pre-resolved plugin instances
 * @returns An async generator yielding markdown chunks
 */
export async function* streamHtmlToMarkdown(
  htmlStream: ReadableStream<Uint8Array | string> | null,
  options: EngineOptions = {},
  resolvedPlugins: Plugin[] = [],
): AsyncIterable<string> {
  if (!htmlStream) {
    throw new Error('Invalid HTML stream provided')
  }
  const decoder = new TextDecoder()
  const reader = htmlStream.getReader()

  const processor = createMarkdownProcessor(options, resolvedPlugins)
  const parseState: ParseState = {
    depthMap: new Uint8Array(1024),
    depth: 0,
    resolvedPlugins,
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
        processPluginsForEvent(event, resolvedPlugins, processor.state, processor.processEvent)
      })

      const chunk = processor.getMarkdownChunk()
      if (chunk) {
        yield chunk
      }
    }
    // Process any remaining HTML and emit final chunk
    if (remainingHtml) {
      parseHtmlStream(remainingHtml, parseState, (event) => {
        processPluginsForEvent(event, resolvedPlugins, processor.state, processor.processEvent)
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
