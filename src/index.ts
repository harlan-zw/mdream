import type { HTMLToMarkdownOptions } from './types'
import { createMarkdownProcessor } from './markdown-processor'

export function htmlToMarkdown(
  html: string,
  options: HTMLToMarkdownOptions = {},
): string {
  const processor = createMarkdownProcessor(options)

  // Use streaming approach to properly integrate plugins with processor state
  processor.processHtml(html)

  return processor.getMarkdown()
}

export { TagIdMap } from './const'
export { MarkdownProcessor } from './markdown-processor'
export { parseHtml } from './parse'
export { createPlugin } from './pluggable/plugin'
export { streamHtmlToMarkdown } from './stream'

export type * from './types'
