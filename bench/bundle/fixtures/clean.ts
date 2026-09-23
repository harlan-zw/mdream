import { htmlToMarkdown } from '@mdream/js'
import { clean } from '@mdream/js/clean'

export function convert(html: string): string {
  return htmlToMarkdown(html, { clean: clean() })
}
