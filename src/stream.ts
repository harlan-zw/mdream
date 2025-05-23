import type { ReadableStream } from 'node:stream/web'
import type { HTMLToMarkdownOptions, MdreamRuntimeState } from './types'
import { assembleBufferedContent } from './buffer-region'
import { processPartialHTMLToMarkdown } from './parser'

/**
 * Check if buffer regions are active in the state
 */
function hasActiveBufferRegions(state: MdreamRuntimeState): boolean {
  return !!(state.bufferRegions && state.nodeRegionMap)
}

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

  // Initialize state
  const state: MdreamRuntimeState = {
    options,
  }

  let remainingHtml = ''

  try {
    while (true) {
      const { done, value } = await reader.read()

      if (done) {
        // End of stream - process any remaining HTML and yield final content
        if (remainingHtml.trim()) {
          const finalResult = processPartialHTMLToMarkdown(remainingHtml, state)

          if (hasActiveBufferRegions(state)) {
            // Use buffer regions to assemble final content
            const finalContent = assembleBufferedContent(state)
            if (finalContent) {
              yield finalContent
            }
          }
          else {
            // Direct yield for non-buffer-region content
            if (finalResult.chunk) {
              yield finalResult.chunk
            }
          }
        }
        else if (hasActiveBufferRegions(state)) {
          // Yield any remaining buffer region content
          const finalContent = assembleBufferedContent(state)
          if (finalContent) {
            yield finalContent
          }
        }
        break
      }

      // Process the HTML chunk
      const htmlContent = `${remainingHtml}${typeof value === 'string' ? value : decoder.decode(value, { stream: true })}`
      const result = processPartialHTMLToMarkdown(htmlContent, state)

      if (hasActiveBufferRegions(state)) {
        // Buffer region mode: content is filtered during processing
        // The result.chunk contains only included content based on buffer regions
        if (result.chunk) {
          yield result.chunk
        }
      }
      else {
        // Direct mode: yield content immediately
        if (result.chunk) {
          yield result.chunk
        }
      }

      remainingHtml = result.remainingHTML
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
