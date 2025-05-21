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
    bufferMarkers: [], // Initialize empty buffer markers array
  }

  let remainingHtml = ''

  // Track all content and use it as a buffer
  let markdownBuffer = ''

  // Current buffer state
  let isBufferPaused = false

  try {
    while (true) {
      const { done, value } = await reader.read()

      const hasBufferMarkers = state.bufferMarkers?.length

      if (done) {
        // End of stream, flush any remaining buffered content
        // Check if we have any final markers to apply
        let shouldYieldBuffer = true
        let resumeFromPosition = 0

        if (hasBufferMarkers) {
          // Get the last marker to determine final buffer state
          const lastMarker = state.bufferMarkers[state.bufferMarkers.length - 1]
          if (lastMarker.pause) {
            shouldYieldBuffer = false
          }
          else if (lastMarker.position < markdownBuffer.length) {
            resumeFromPosition = lastMarker.position
          }
        }

        // Handle remaining buffered content based on buffer state
        if (shouldYieldBuffer && markdownBuffer.length > 0) {
          if (resumeFromPosition < markdownBuffer.length) {
            // Yield only content from the resume position onwards
            yield markdownBuffer.substring(resumeFromPosition)
          }
          else {
            // No valid resume position, yield all buffered content
            yield markdownBuffer
          }
        }
        break
      }

      // Process the HTML chunk
      const htmlContent = `${remainingHtml}${typeof value === 'string' ? value : decoder.decode(value, { stream: true })}`
      const result = processPartialHTMLToMarkdown(htmlContent, state)

      // Update buffer state based on markers
      if (hasBufferMarkers) {
        // Find all markers that apply to the current buffer position
        const currentPosition = markdownBuffer.length

        // Sort markers by position to apply in order
        const relevantMarkers = state.bufferMarkers
          .filter(marker => marker.position <= currentPosition)
          .sort((a, b) => b.position - a.position)

        // Apply the most recent marker
        if (relevantMarkers.length > 0) {
          const latestMarker = relevantMarkers[0]
          isBufferPaused = latestMarker.pause

          // Remove applied markers
          state.bufferMarkers = state.bufferMarkers.filter(
            marker => marker.position > currentPosition,
          )
        }
      }

      // Update isBufferPaused for consistency with utility functions
      state.isBufferPaused = isBufferPaused

      if (isBufferPaused) {
        // In buffering mode, append to buffer but don't yield yet
        markdownBuffer += result.chunk
      }
      else if (markdownBuffer.length > 0) {
        // We've stopped buffering, handle any buffered content first
        let resumeFromPosition = 0
        let skipBuffer = false

        // Check buffer markers for resume position
        if (state.bufferMarkers && state.bufferMarkers.length > 0) {
          // Find markers with very high position value and isPaused=true for skipping buffer
          const skipMarkers = state.bufferMarkers
            .filter(marker => marker.pause && marker.position > markdownBuffer.length)

          if (skipMarkers.length > 0) {
            skipBuffer = true
          }
          else {
            // Find the last resume marker (isPaused=false)
            const resumeMarkers = state.bufferMarkers
              .filter(marker => !marker.pause)
              .sort((a, b) => b.position - a.position)

            if (resumeMarkers.length > 0) {
              resumeFromPosition = resumeMarkers[0].position
            }
          }
        }

        if (skipBuffer) {
          // Skip all buffered content
          markdownBuffer = ''
        }
        else if (resumeFromPosition < markdownBuffer.length) {
          // Yield only the content from resume position onwards
          yield markdownBuffer.substring(resumeFromPosition)
          markdownBuffer = ''
        }
        else {
          // Resume position is beyond or equal to our buffered content,
          // yield all buffered content
          yield markdownBuffer
          markdownBuffer = ''
        }

        // Then yield current chunk if we're not buffering
        if (!isBufferPaused) {
          yield result.chunk
        }

        // Update buffer with current chunk
        markdownBuffer += result.chunk
      }
      else {
        // Normal mode (not buffering, no buffered content), just yield the current chunk
        yield result.chunk

        // Update position tracking
        markdownBuffer += result.chunk
      }

      remainingHtml = result.remainingHTML
    }
  }
  finally {
    // Ensure any final decoding happens
    if (remainingHtml) {
      decoder.decode(new Uint8Array(0), { stream: false })
    }
    reader.releaseLock()
  }
}
