import type { ReadableStream } from 'node:stream/web'
import type { HTMLToMarkdownOptions, MdreamRuntimeState } from './types'
import { processPartialHTMLToMarkdown } from './parser'

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
  const state: Partial<MdreamRuntimeState> = {
    options,
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
      const result = processPartialHTMLToMarkdown(htmlContent, state)

      if (result.chunk) {
        yield result.chunk
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
