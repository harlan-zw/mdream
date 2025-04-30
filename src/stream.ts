import type { DownstreamState } from './types.ts'

import { processPartialHTMLToMarkdown } from './parser.ts'

/**
 * Adapter for processing HTML streams and converting them to markdown streams
 */
export class HTMLStreamAdapter {
  public pendingChunk: string = ''
  public state: DownstreamState = {} as DownstreamState

  // need a constructor for options
  constructor(options: Partial<DownstreamState> = {}) {
    this.state = {
      ...this.state,
      options,
    }
  }

  /**
   * Process an HTML chunk and return any complete markdown that can be generated
   * @returns The processed markdown content
   */
  async processChunk(
    htmlChunk: string,
  ): Promise<string> {
    // Convert complete HTML to markdown using the same state
    const { chunk, remainingHTML } = processPartialHTMLToMarkdown(`${this.pendingChunk}${htmlChunk}`, this.state)
    this.pendingChunk = remainingHTML
    return chunk
  }

  /**
   * Process all remaining buffered content
   * @returns The processed markdown content
   */
  async flush(
  ): Promise<string> {
    // Process any remaining content in the buffer
    if (this.pendingChunk.length === 0) {
      return ''
    }
    const { chunk, remainingHTML } = processPartialHTMLToMarkdown(this.pendingChunk, this.state)

    // Clear the buffer
    this.pendingChunk = ''

    return [chunk, remainingHTML].join('')
  }
}

/**
 * Creates a markdown stream from an HTML stream
 * @returns An async generator yielding markdown chunks
 */
export async function* createMarkdownStreamFromHTMLStream(
  htmlStream: AsyncIterable<string>,
  options: Partial<DownstreamState> = {},
): AsyncGenerator<string> {
  const adapter = new HTMLStreamAdapter(options)

  for await (const htmlChunk of htmlStream) {
    const markdownChunk = await adapter.processChunk(htmlChunk)

    if (markdownChunk) {
      yield markdownChunk
    }
  }

  // TODO maybe
  // Process any remaining content
  const finalChunk = await adapter.flush()

  if (finalChunk) {
    yield finalChunk
  }
}
