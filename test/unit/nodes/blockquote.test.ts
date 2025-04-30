import { describe, expect, it } from 'vitest'
import { syncHtmlToMarkdown } from '../../../src/index.js'

describe('blockquotes', () => {
  it('converts blockquotes', async () => {
    const html = '<blockquote>This is a quote</blockquote>'
    const markdown = syncHtmlToMarkdown(html)
    expect(markdown).toBe('> This is a quote')
  })

  it('handles nested blockquotes', async () => {
    const html = '<blockquote>Outer quote<blockquote>Inner quote</blockquote></blockquote>'
    const markdown = syncHtmlToMarkdown(html)
    expect(markdown).toBe('> Outer quote\n> > Inner quote')
  })

  it('handles blockquotes with paragraphs', async () => {
    const html = '<blockquote><p>First paragraph</p><p>Second paragraph</p></blockquote>'
    const markdown = syncHtmlToMarkdown(html)
    expect(markdown).toBe('> First paragraph\n> Second paragraph')
  })

  it('handles complex nested blockquotes', async () => {
    const html = '<blockquote><p>Outer paragraph</p><blockquote><p>Inner paragraph</p></blockquote></blockquote>'
    const markdown = syncHtmlToMarkdown(html)

    expect(markdown).toBe('> Outer paragraph\n> > Inner paragraph')
  })
  // test for > A quote with an ![image](image.jpg) inside.
  it('handles blockquotes with images', async () => {
    const html = '<blockquote>This is a quote with an <img src="image.jpg" alt="image"></blockquote>'
    const markdown = syncHtmlToMarkdown(html)
    expect(markdown).toBe('> This is a quote with an ![image](image.jpg)')
  })
})
