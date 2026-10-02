// Type checked with no custom condition (tsconfig.node.json).
import type { MdreamOptions } from 'mdream'
import { htmlToMarkdown } from 'mdream'

const options: MdreamOptions = { minimal: true }
export const markdown: string = htmlToMarkdown('<h1>Hi</h1>', options)
