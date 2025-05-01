import { describe, expect, it } from 'vitest'
import { asyncHtmlToMarkdown } from '../../../src'

describe('text Formatting', async () => {
  it('converts bold text with <strong>', async () => {
    const html = '<p>This is <strong>bold</strong> text</p>'
    const markdown = await asyncHtmlToMarkdown(html)
    expect(markdown).toBe('This is **bold** text')
  })

  it('converts bold text with <b>', async () => {
    const html = '<p>This is <b>bold</b> text</p>'
    const markdown = await asyncHtmlToMarkdown(html)
    expect(markdown).toBe('This is **bold** text')
  })

  it('converts italic text with <em>', async () => {
    const html = '<p>This is <em>italic</em> text</p>'
    const markdown = await asyncHtmlToMarkdown(html)
    expect(markdown).toBe('This is *italic* text')
  })

  it('converts italic text with <i>', async () => {
    const html = '<p>This is <i>italic</i> text</p>'
    const markdown = await asyncHtmlToMarkdown(html)
    expect(markdown).toBe('This is *italic* text')
  })

  it('handles nested formatting', async () => {
    const html = '<p>This is <strong><em>bold and italic</em></strong> text</p>'
    const markdown = await asyncHtmlToMarkdown(html)
    expect(markdown).toBe('This is ***bold and italic*** text')
  })
})
