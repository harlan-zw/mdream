import { describe, expect, it, vi } from 'vitest'
import { htmlToMarkdown } from '../../src'

describe('htmlToMarkdown resolve options', () => {
  it('throws TypeError when plugins array is passed', () => {
    expect(() => htmlToMarkdown('<p>test</p>', { plugins: [] } as any))
      .toThrow(TypeError)
    expect(() => htmlToMarkdown('<p>test</p>', { plugins: [{}] } as any))
      .toThrow('Custom hook plugins require @mdream/js')
  })

  it('minimal enables frontmatter, isolateMain, tailwind, filter', () => {
    const html = `<html><head><title>Test</title></head><body><main><nav>nav</nav><h1>Hello</h1><p>World</p></main></body></html>`
    const md = htmlToMarkdown(html, { minimal: true })
    expect(md).toContain('---')
    expect(md).toContain('title:')
    expect(md).toContain('# Hello')
    expect(md).toContain('World')
    expect(md).not.toContain('nav')
  })

  it('clean: true enables all cleanup', () => {
    const html = `<p><a href="https://example.com">https://example.com</a></p>`
    const md = htmlToMarkdown(html, { clean: true })
    // redundantLinks should simplify [url](url) to just url
    expect(md).toContain('https://example.com')
    expect(md).not.toContain('[https://example.com](https://example.com)')
  })

  it('clean: partial enables specific cleanup', () => {
    const html = `<p><a href="https://example.com?utm_source=test">Link</a></p>`
    const md = htmlToMarkdown(html, { clean: { urls: true } })
    expect(md).not.toContain('utm_source')
  })

  it('frontmatter callback receives extracted data', () => {
    const cb = vi.fn()
    const html = `<html><head><title>Page</title></head><body><p>Content</p></body></html>`
    htmlToMarkdown(html, { frontmatter: cb })
    expect(cb).toHaveBeenCalledOnce()
    expect(cb).toHaveBeenCalledWith(expect.objectContaining({ title: expect.any(String) }))
  })

  it('frontmatter config object with onExtract', () => {
    const cb = vi.fn()
    const html = `<html><head><title>Page</title></head><body><p>Content</p></body></html>`
    htmlToMarkdown(html, { frontmatter: { onExtract: cb } })
    expect(cb).toHaveBeenCalledOnce()
  })

  it('extraction handlers receive matched elements', () => {
    const cb = vi.fn()
    const html = `<h2>Section Title</h2><p>Content</p>`
    htmlToMarkdown(html, { extraction: { h2: cb } })
    expect(cb).toHaveBeenCalledOnce()
    expect(cb).toHaveBeenCalledWith(expect.objectContaining({
      selector: 'h2',
      textContent: expect.stringContaining('Section Title'),
    }))
  })

  it('tagOverrides string shorthand acts as alias', () => {
    const html = `<custom-tag>content</custom-tag>`
    const md = htmlToMarkdown(html, { tagOverrides: { 'custom-tag': 'strong' } })
    expect(md).toContain('**content**')
  })

  it('streamHtmlToMarkdown throws on null stream', async () => {
    const { streamHtmlToMarkdown } = await import('../../src')
    const gen = streamHtmlToMarkdown(null as any)
    await expect(async () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for await (const _ of gen) { /* noop */ }
    }).rejects.toThrow('Invalid HTML stream')
  })
})
