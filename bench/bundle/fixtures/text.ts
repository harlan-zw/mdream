import { htmlToText } from '@mdream/js/text'

export function convert(html: string): string {
  return htmlToText(html)
}
