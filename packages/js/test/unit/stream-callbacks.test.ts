import { describe, expect, it, vi } from 'vitest'
import { htmlToMarkdown, streamHtmlToMarkdown } from '../../src/index'

describe('stream callbacks', () => {
  it('calls the frontmatter callback and extraction handlers like one-shot', async () => {
    const html = '<html><head><title>Page</title></head><body><p><a href="/a">A</a></p></body></html>'
    const frontmatter = vi.fn()
    const link = vi.fn()
    const stream = new ReadableStream<string>({
      start(controller) {
        controller.enqueue(html.slice(0, 30))
        controller.enqueue(html.slice(30))
        controller.close()
      },
    })
    let output = ''
    for await (const chunk of streamHtmlToMarkdown(stream, { plugins: { frontmatter, extraction: { 'a[href]': link } } }))
      output += chunk
    expect(output).toBe(htmlToMarkdown(html, { plugins: { frontmatter: true } }))
    expect(frontmatter).toHaveBeenCalledWith({ title: 'Page' })
    expect(link).toHaveBeenCalledOnce()
  })
})
