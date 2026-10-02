import { htmlToMarkdown } from '@mdream/js'

export function convert(html: string): string {
  return htmlToMarkdown(html)
}
