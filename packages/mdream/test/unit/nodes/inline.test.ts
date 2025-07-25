import { describe, expect, it } from 'vitest'
import { htmlToMarkdown } from '../../../src'

describe('text Formatting', () => {
  it('converts bold text with <strong>', () => {
    const html = '<p>This is <strong>bold</strong> text</p>'
    const markdown = htmlToMarkdown(html)
    expect(markdown).toBe('This is **bold** text')
  })

  it('converts bold text with <b>', () => {
    const html = '<p>This is <b>bold</b> text</p>'
    const markdown = htmlToMarkdown(html)
    expect(markdown).toBe('This is **bold** text')
  })

  it('converts italic text with <em>', () => {
    const html = '<p>This is <em>italic</em> text</p>'
    const markdown = htmlToMarkdown(html)
    expect(markdown).toBe('This is _italic_ text')
  })

  it('converts italic text with <i>', () => {
    const html = '<p>This is <i>italic</i> text</p>'
    const markdown = htmlToMarkdown(html)
    expect(markdown).toBe('This is _italic_ text')
  })

  it('handles nested formatting', () => {
    const html = '<p>This is <strong><em>bold and italic</em></strong> text</p>'
    const markdown = htmlToMarkdown(html)
    expect(markdown).toBe('This is **_bold and italic_** text')
  })
})
