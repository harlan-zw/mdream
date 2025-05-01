import type { HTMLToMarkdownOptions, MdreamRuntimeState } from './types.ts'
import { DEFAULT_CHUNK_SIZE } from './const.ts'
import { processPartialHTMLToMarkdown } from './parser.ts'

/**
 * Creates a markdown stream from an HTML stream
 * @param htmlStream - ReadableStream of HTML content (as Uint8Array or string)
 * @param options - Configuration options for conversion
 * @returns An async generator yielding markdown chunks
 */
export async function* streamHtmlToMarkdown(
  htmlStream: ReadableStream<Uint8Array | string>,
  options: HTMLToMarkdownOptions = {},
): AsyncIterable<string> {
  const chunkSize = options.chunkSize || DEFAULT_CHUNK_SIZE
  const reader = htmlStream.getReader()
  const decoder = new TextDecoder()

  // Initialize state
  const state: Partial<MdreamRuntimeState> = {
    options,
    buffer: '',
  }

  let inputBuffer = ''
  let pendingHtml = ''

  try {
    while (true) {
      const { done, value } = await reader.read()

      if (done) {
        // Process any remaining content
        if (inputBuffer.length > 0 || pendingHtml.length > 0) {
          const finalChunk = pendingHtml + inputBuffer
          if (finalChunk.length > 0) {
            const { chunk } = processPartialHTMLToMarkdown(finalChunk, state)
            if (chunk) {
              yield chunk
            }
          }
        }
        break
      }

      // Decode binary chunk to string if needed
      inputBuffer += typeof value === 'string'
        ? value
        : decoder.decode(value, { stream: true })

      // Process buffer in chunks
      while (inputBuffer.length >= chunkSize) {
        const currentChunk = pendingHtml + inputBuffer.slice(0, chunkSize)
        const result = processPartialHTMLToMarkdown(currentChunk, state)

        if (result.chunk) {
          yield result.chunk
        }

        pendingHtml = result.remainingHTML
        inputBuffer = inputBuffer.slice(chunkSize)
      }
    }

    // Final cleanup - decode any remaining bytes
    if (inputBuffer.length === 0) {
      const finalBytes = decoder.decode()
      if (finalBytes) {
        const result = processPartialHTMLToMarkdown(pendingHtml + finalBytes, state)
        if (result.chunk) {
          yield result.chunk
        }
      }
    }
  }
  finally {
    reader.releaseLock()
  }
}
