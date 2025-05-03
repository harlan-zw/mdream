import type { HTMLToMarkdownOptions } from './types.ts'
import { streamHtmlToMarkdown } from './stream.ts'
import { asyncIterableToString, stringToReadableStream } from './utils.ts'

/**
 * Converts HTML string to Markdown
 * @param html HTML content to convert
 * @param options Conversion options
 * @returns Promise resolving to Markdown string
 */
export async function asyncHtmlToMarkdown(
  html: string,
  options: HTMLToMarkdownOptions = {},
): Promise<string> {
  const res = await asyncIterableToString(
    streamHtmlToMarkdown(stringToReadableStream(html), options),
  )
  return res.trimEnd()
}

export { streamHtmlToMarkdown } from './stream.ts'

export type * from './types.ts'
