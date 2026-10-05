// Type checked with the `browser` export condition (tsconfig.browser.json).
import { htmlToMarkdown } from 'mdream'

export const markdown: Promise<string> = htmlToMarkdown('<h1>Hi</h1>', { minimal: true })
