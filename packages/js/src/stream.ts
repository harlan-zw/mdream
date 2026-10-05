import type { ParseState } from './parse'
import type { EngineOptions, NodeEvent, TagHandler, TransformPlugin } from './types'
import { createMarkdownProcessor } from './markdown-processor'
import { createMarkdownDrain } from './markdown-stream'
import { finalizeParse, parseHtmlStream } from './parse'
import { endPlugins, processPluginsForEvent } from './plugin-processor'
import { tagHandlers } from './tags'

/**
 * Creates a markdown stream from an HTML stream
 * @param htmlStream - ReadableStream of HTML content (as Uint8Array or string)
 * @param options - Configuration options for conversion
 * @param resolvedPlugins - Pre-resolved plugin instances
 * @param tagOverrideHandlers - Tag override handlers from declarative config
 * @returns An async generator yielding markdown chunks
 */
export async function* streamHtmlToMarkdown(
  htmlStream: ReadableStream<Uint8Array | string> | null,
  options: EngineOptions = {},
  resolvedPlugins: TransformPlugin[] = [],
  tagOverrideHandlers?: Map<string, TagHandler>,
): AsyncIterable<string> {
  if (!htmlStream) {
    throw new Error('Invalid HTML stream provided')
  }
  const decoder = new TextDecoder('utf-8', { ignoreBOM: true })
  let hasDecodedContent = false
  const reader = htmlStream.getReader()

  const processor = createMarkdownProcessor(options, context => createMarkdownDrain(context, resolvedPlugins.length > 0))
  const parseState: ParseState = {
    depthMap: processor.state.depthMap,
    depth: 0,
    resolvedPlugins,
    tagHandlers,
    tagOverrideHandlers,
    plainText: false,
  }
  const handleEvent: (event: NodeEvent) => void = resolvedPlugins.length
    ? event => processPluginsForEvent(event, resolvedPlugins, processor.state, processor.processEvent)
    : processor.processEvent

  let remainingHtml = ''

  try {
    while (true) {
      const { done, value } = await reader.read()

      if (done) {
        break
      }

      // An empty string does not end a pending UTF-8 byte sequence.
      if (value === '')
        continue

      // Process the HTML chunk
      let decoded = typeof value === 'string'
        ? decoder.decode() + value
        : decoder.decode(value, { stream: true })
      if (decoded && !hasDecodedContent) {
        hasDecodedContent = true
        if (typeof value !== 'string' && decoded.charCodeAt(0) === 0xFEFF)
          decoded = decoded.slice(1)
      }
      const htmlContent = `${remainingHtml}${decoded}`

      remainingHtml = parseHtmlStream(htmlContent, parseState, handleEvent)

      const chunk = processor.getMarkdownChunk()
      if (chunk) {
        yield chunk
      }
    }
    // Process any remaining HTML, then commit trailing text and close any
    // elements left open at end of input.
    const decoderTail = decoder.decode()
    const finalHtml = remainingHtml + decoderTail
    const leftover = finalHtml
      ? parseHtmlStream(finalHtml, parseState, handleEvent)
      : ''
    finalizeParse(leftover, parseState, handleEvent)
    endPlugins(resolvedPlugins, processor.state)

    // Emit any final content
    const finalChunk = processor.getMarkdownChunk(true)
    if (finalChunk) {
      yield finalChunk
    }
  }
  finally {
    reader.releaseLock()
  }
}
