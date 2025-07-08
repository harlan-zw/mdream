import { describe, expect, it } from 'vitest'
import { htmlToMarkdown } from '../../../src/index.js'

describe('blockquotes', () => {
  it('converts blockquotes', () => {
    const html = '<blockquote>This is a quote</blockquote>'
    const markdown = htmlToMarkdown(html)
    expect(markdown).toBe('> This is a quote')
  })

  it('handles nested blockquotes', () => {
    const html = '<blockquote>Outer quote<blockquote>Inner quote</blockquote></blockquote>'
    const markdown = htmlToMarkdown(html)
    expect(markdown).toBe('> Outer quote\n> > Inner quote')
  })

  it.skip('handles blockquotes with paragraphs', () => {
    const html = '<blockquote><p>First paragraph</p><p>Second paragraph</p></blockquote>'
    const markdown = htmlToMarkdown(html)
    expect(markdown).toBe('> First paragraph\n> Second paragraph')
  })

  it('handles complex nested blockquotes', () => {
    const html = '<blockquote><p>Outer paragraph</p><blockquote><p>Inner paragraph</p></blockquote></blockquote>'
    const markdown = htmlToMarkdown(html)

    expect(markdown).toBe('> Outer paragraph\n> > Inner paragraph')
  })
  // test for > A quote with an ![image](image.jpg) inside.
  it('handles blockquotes with images', () => {
    const html = '<blockquote>This is a quote with an <img src="image.jpg" alt="image"></blockquote>'
    const markdown = htmlToMarkdown(html)
    expect(markdown).toBe('> This is a quote with an ![image](image.jpg)')
  })
})
