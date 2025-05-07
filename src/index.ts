import type { HTMLToMarkdownOptions, MdreamRuntimeState } from './types.ts'
import { processPartialHTMLToMarkdown } from './parser.ts'

export function syncHtmlToMarkdown(
  html: string,
  options: HTMLToMarkdownOptions = {},
): string {
  // Initialize state
  const state: Partial<MdreamRuntimeState> = {
    options,
  }
  return processPartialHTMLToMarkdown(html, state).chunk.trimEnd()
}

export { streamHtmlToMarkdown } from './stream.ts'

export type * from './types.ts'
