import { htmlToSafeHtml } from '@mdream/js/html'

export function convert(html: string): string {
  return htmlToSafeHtml(html)
}
