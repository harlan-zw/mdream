import { describe, expect, it } from 'vitest'
import { asyncHtmlToMarkdown } from '../../../src'

describe('links', async () => {
  it('converts simple links', async () => {
    const html = '<a href="https://example.com">Example</a>'
    const markdown = await asyncHtmlToMarkdown(html)
    expect(markdown).toBe('[Example](https://example.com)')
  })

  it('handles links with titles', async () => {
    const html = '<a href="https://example.com" title="Example Site">Example</a>'
    const markdown = await asyncHtmlToMarkdown(html)
    expect(markdown).toBe('[Example](https://example.com)')
  })

  it('handles links in paragraphs', async () => {
    const html = '<p>Visit <a href="https://example.com">Example</a> for more info.</p>'
    const markdown = await asyncHtmlToMarkdown(html)
    expect(markdown).toBe('Visit [Example](https://example.com) for more info.')
  })
})
