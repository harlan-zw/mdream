import { htmlToMarkdown } from '@mdream/js'
import { filterPlugin } from '@mdream/js/plugins'

const filter = filterPlugin({ exclude: ['nav', 'footer'] })

export function convert(html: string): string {
  return htmlToMarkdown(html, { plugins: [filter] })
}
