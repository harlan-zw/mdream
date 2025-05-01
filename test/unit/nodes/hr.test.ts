import { describe, expect, it } from 'vitest'
import { asyncHtmlToMarkdown } from '../../../src/index.js'

describe('horizontal Rules', async () => {
  it('converts hr elements', async () => {
    const html = '<p>Above</p><hr><p>Below</p>'
    const markdown = await asyncHtmlToMarkdown(html)
    expect(markdown).toBe('Above\n\n---\n\nBelow')
  })
})
