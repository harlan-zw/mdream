import type { HTMLToMarkdownOptions } from './types.ts'
import { processPartialHTMLToMarkdown } from './parser.ts'

export function syncHtmlToMarkdown(
  html: string,
  options: HTMLToMarkdownOptions = {},
): string {
  const { chunk } = processPartialHTMLToMarkdown(html, { options })
  // Fix double newlines in lists by normalizing
  return chunk
    .trimEnd()
}

export { createMarkdownStreamFromHTMLStream } from './stream.ts'

export type * from './types.ts'
