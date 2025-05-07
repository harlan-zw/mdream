import type { ReadableStream } from 'node:stream/web'
import type { HTMLToMarkdownOptions, MdreamRuntimeState } from './types.ts'
import { processPartialHTMLToMarkdown } from './parser.ts'

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
  let lastChunk: string | undefined
  try {
    while (true) {
      const { done, value } = await reader.read()

      if (done) {
        if (lastChunk) {
          yield lastChunk.trimEnd()
        }
        break
      }

      const result = processPartialHTMLToMarkdown(`${remainingHtml}${typeof value === 'string' ? value : decoder.decode(value)}`, state)

      if (lastChunk) {
        yield lastChunk
      }
      lastChunk = result.chunk

      remainingHtml = result.remainingHTML
    }
  }
  finally {
    reader.releaseLock()
  }
}
