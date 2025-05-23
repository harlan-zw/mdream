import type { HTMLToMarkdownOptions, MdreamRuntimeState } from './types'
import { assembleBufferedContent } from './buffer-region'
import { processPartialHTMLToMarkdown } from './parser'

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

  // Use buffer regions if active, otherwise use legacy buffer markers
  if (state.bufferRegions && state.nodeRegionMap) {
    return assembleBufferedContent(state).trimEnd()
  }
  else {
    return result.trimEnd()
  }
}

export { streamHtmlToMarkdown } from './stream'

export type * from './types'
