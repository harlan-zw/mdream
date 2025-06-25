import type { HTMLToMarkdownOptions, MdreamRuntimeState } from './types'
import { processPartialHTMLToMarkdown } from './parser'

export function htmlToMarkdown(
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

export { TagIdMap } from './const'

export { streamHtmlToMarkdown } from './stream'

export type * from './types'
