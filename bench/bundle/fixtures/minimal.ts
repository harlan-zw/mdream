import { htmlToMarkdown } from '@mdream/js'
import { withMinimalPreset } from '@mdream/js/preset/minimal'

export function convert(html: string): string {
  return htmlToMarkdown(html, withMinimalPreset())
}
