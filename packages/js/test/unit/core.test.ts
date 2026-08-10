import { describe, expect, it } from 'vitest'
import { TAG_NAV } from '../../src/const'
import { htmlToMarkdown, streamHtmlToMarkdown } from '../../src/core'
import { htmlToMarkdown as fullHtmlToMarkdown } from '../../src/index'
import { filterPlugin } from '../../src/plugins/filter'

describe('core entry', () => {
  it('matches the package root without declarative plugins', () => {
    const html = '<main><h1>Hello</h1><p>A <strong>small</strong> test.</p></main>'
    expect(htmlToMarkdown(html)).toBe(fullHtmlToMarkdown(html))
  })

  it('retains hooks and tag overrides', () => {
    expect(htmlToMarkdown('<x-title>Hello</x-title>', {
      plugins: { tagOverrides: { 'x-title': 'h2' } },
    })).toBe('## Hello')
  })

  it('supports the pre-v1 composable plugin array', () => {
    expect(htmlToMarkdown('<nav>hidden</nav><p>shown</p>', {
      plugins: [filterPlugin({ exclude: [TAG_NAV] })],
    })).toBe('shown')
  })

  it('streams without declarative plugins', async () => {
    const html = '<h1>Hello</h1>'
    const stream = new ReadableStream<string>({
      start(controller) {
        controller.enqueue(html)
        controller.close()
      },
    })
    let markdown = ''
    for await (const chunk of streamHtmlToMarkdown(stream))
      markdown += chunk
    expect(markdown).toBe(htmlToMarkdown(html))
  })

  it('falls back to markdown for an unsupported runtime format', async () => {
    const html = '<p>&amp;copy;</p>'
    const options = { format: 'unsupported' } as unknown as Parameters<typeof htmlToMarkdown>[1]
    const expected = htmlToMarkdown(html)
    expect(htmlToMarkdown(html, options)).toBe(expected)

    const stream = new Blob([html]).stream()
    let markdown = ''
    for await (const chunk of streamHtmlToMarkdown(stream, options))
      markdown += chunk
    expect(markdown).toBe(expected)
  })
})
