// Type checked with no custom condition (tsconfig.browser.json).
import { htmlToMarkdown } from 'mdream/browser'

export const markdown: Promise<string> = htmlToMarkdown('<h1>Hi</h1>', { minimal: true })
