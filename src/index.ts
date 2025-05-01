import type { HTMLToMarkdownOptions } from './types.ts'
import { streamHtmlToMarkdown } from './stream.ts'
import { asyncIterableToString, stringToReadableStream } from './utils.ts'

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
