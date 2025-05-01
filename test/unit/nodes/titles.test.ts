import { describe, expect, it } from 'vitest'
import { asyncHtmlToMarkdown } from '../../../src/index.js'

describe('h1', async () => {
  // <h1>1. Hello world</h1>
  it('avoids rendering as list', async () => {
    const html = '<h1>1. Hello world</h1>'
    const markdown = await asyncHtmlToMarkdown(html)
    expect(markdown).toBe('# 1. Hello world')
  })
})
