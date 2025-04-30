import { readFile, writeFile } from 'node:fs/promises'
// read file github-markdown-complete and generate the nodes for it
import { describe, it } from 'vitest'

import { processPartialHTMLToMarkdown } from '../../../src/parser.ts'

const dirname = new URL('.', import.meta.url).pathname

describe('combined Elements', () => {
  it.skip('handles complex content with multiple element types', async () => {
    const fs = await readFile(`${dirname}/../../github-markdown-complete.html`, { encoding: 'utf-8' })

    // manually chunk into 4028 byte chunks
    const chunkSize = 4028
    const chunks = []
    for (let i = 0; i < fs.length; i += chunkSize) {
      chunks.push(fs.slice(i, i + chunkSize))
    }
    const state = {}
    const ev = []
    let pendingChunk = ''
    for (const htmlChunk of chunks) {
      const { events, remainingHTML } = processPartialHTMLToMarkdown(`${pendingChunk}${htmlChunk}`, state)
      ev.push(...events.map((e) => {
        // drop circular deps
        if (e.node) {
          e.node.stackId = undefined
          e.node.parentNode = undefined
          e.node.children = undefined
        }
        return e
      }))
      pendingChunk = remainingHTML
    }
    // read to file
    await writeFile(`${dirname}/../../github-markdown-events.json`, JSON.stringify(ev), { encoding: 'utf-8' })
  })
})
