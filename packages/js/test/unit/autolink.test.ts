import { describe, expect, it } from 'vitest'
import { htmlToMarkdown } from '../../src/index'

describe('gfm autolink shorthand', () => {
  it('collapses link when text equals href', () => {
    expect(htmlToMarkdown('<a href="https://example.com">https://example.com</a>'))
      .toBe('<https://example.com>')
  })

  it('collapses mailto links', () => {
    expect(htmlToMarkdown('<a href="mailto:hi@example.com">mailto:hi@example.com</a>'))
      .toBe('<mailto:hi@example.com>')
  })

  it('collapses autolink inside a paragraph', () => {
    expect(htmlToMarkdown('<p>Visit <a href="https://example.com">https://example.com</a> now.</p>'))
      .toBe('Visit <https://example.com> now.')
  })

  it('collapses ftp links', () => {
    expect(htmlToMarkdown('<a href="ftp://files.example.com">ftp://files.example.com</a>'))
      .toBe('<ftp://files.example.com>')
  })

  it('does not collapse hrefs containing whitespace', () => {
    expect(htmlToMarkdown('<a href="https://example.com/a b">https://example.com/a b</a>'))
      .toBe('[https://example.com/a b](https://example.com/a b)')
  })

  it('keeps verbose link when text differs from href', () => {
    expect(htmlToMarkdown('<a href="https://example.com">Example</a>'))
      .toBe('[Example](https://example.com)')
  })

  it('keeps verbose link when a title is present', () => {
    expect(htmlToMarkdown('<a href="https://example.com" title="Site">https://example.com</a>'))
      .toBe('[https://example.com](https://example.com "Site")')
  })

  it('does not collapse relative hrefs', () => {
    expect(htmlToMarkdown('<a href="/page">/page</a>'))
      .toBe('[/page](/page)')
  })

  it('clean mode strips the autolink to bare text via redundantLinks', () => {
    expect(htmlToMarkdown('<a href="https://example.com">https://example.com</a>', { clean: true }))
      .toBe('https://example.com')
  })
})
