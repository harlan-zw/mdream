// Code shared by server and client. The client build folds the SSR branch
// away, so this module never calls mdream in the browser.
import { htmlToMarkdown } from 'mdream/browser'

export function toMarkdown(html) {
  if (import.meta.env.SSR)
    return htmlToMarkdown(html)
  return html
}
