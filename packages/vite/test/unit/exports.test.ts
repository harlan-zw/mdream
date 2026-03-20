import { describe, expect, it } from 'vitest'
import { htmlToMarkdown, streamHtmlToMarkdown, viteHtmlToMarkdownPlugin } from '../../src/index.js'

describe('@mdream/vite exports', () => {
  it('should export viteHtmlToMarkdownPlugin', () => {
    expect(typeof viteHtmlToMarkdownPlugin).toBe('function')
  })

  it('should re-export htmlToMarkdown from mdream', () => {
    expect(typeof htmlToMarkdown).toBe('function')

    const result = htmlToMarkdown('<h1>Hello</h1>')
    expect(result).toContain('# Hello')
  })

  it('should re-export streamHtmlToMarkdown from mdream', () => {
    expect(typeof streamHtmlToMarkdown).toBe('function')
  })

  it('should convert HTML with options', () => {
    const result = htmlToMarkdown('<a href="/page">Link</a>', {
      origin: 'https://example.com',
    })

    expect(result).toContain('[Link](https://example.com/page)')
  })
})
