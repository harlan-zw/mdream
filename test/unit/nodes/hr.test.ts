import { describe, expect, it } from 'vitest'
import { syncHtmlToMarkdown } from '../../../src/index.js'

describe('horizontal Rules', () => {
  it('converts hr elements', async () => {
    const html = '<p>Above</p><hr><p>Below</p>'
    const markdown = syncHtmlToMarkdown(html)
    expect(markdown).toBe('Above\n\n---\n\nBelow')
  })
})
