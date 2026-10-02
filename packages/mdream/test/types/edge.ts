// Type checked with the `workerd` export condition (tsconfig.edge.json).
import { htmlToMarkdown } from 'mdream'

export const markdown: string = htmlToMarkdown('<h1>Hi</h1>', { minimal: true })
