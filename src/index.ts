import type { HTMLToMarkdownOptions } from './types'
import { parseHtml } from './parse'
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

export { parseHtml } from './parse'
export { MarkdownProcessor } from './markdown-processor'
export { TagIdMap } from './const'
export { streamHtmlToMarkdown } from './stream'
export { createPlugin } from './pluggable/plugin'

export type * from './types'
