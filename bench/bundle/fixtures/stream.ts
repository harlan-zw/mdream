import { streamHtmlToMarkdown } from '@mdream/js'

export function convertStream(
  html: ReadableStream<Uint8Array | string>,
): AsyncIterable<string> {
  return streamHtmlToMarkdown(html)
}
