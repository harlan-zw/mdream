import { htmlToMarkdown } from '@mdream/js/core'

export function convert(html: string): string {
  return htmlToMarkdown(html)
}
