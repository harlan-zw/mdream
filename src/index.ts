import type { HTMLToMarkdownOptions, MdreamRuntimeState } from './types'
import { processPartialHTMLToMarkdown } from './parser'
import { applyBufferMarkers } from './utils'

export function syncHtmlToMarkdown(
  html: string,
  options: HTMLToMarkdownOptions = {},
): string {
  // Initialize state
  const state: MdreamRuntimeState = {
    options,
  }

  // Process the HTML to markdown
  const result = processPartialHTMLToMarkdown(html, state).chunk
  return applyBufferMarkers(state, result).trimEnd()
}

export { streamHtmlToMarkdown } from './stream'

export type * from './types'
