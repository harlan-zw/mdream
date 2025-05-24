import type { HTMLToMarkdownOptions, MdreamRuntimeState } from './types'
import { processPartialHTMLToMarkdown } from './parser'

export function syncHtmlToMarkdown(
  html: string,
  options: HTMLToMarkdownOptions = {},
): string {
  // Initialize state
  const state = {
    options,
  } as MdreamRuntimeState
  const result = processPartialHTMLToMarkdown(html, state).chunk
  return result.trimEnd()
}

export { streamHtmlToMarkdown } from './stream'

export type * from './types'
