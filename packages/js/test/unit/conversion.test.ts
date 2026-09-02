import { describe, expect, it } from 'vitest'
import { TAG_NAV } from '../../src/const'
import { htmlToMarkdown, streamHtmlToMarkdown } from '../../src/index'
import { filterPlugin } from '../../src/plugins/filter'

describe('root conversion', () => {
  it('converts without loading optional plugins', () => {
    const html = '<main><h1>Hello</h1><p>A <strong>small</strong> test.</p></main>'
    expect(htmlToMarkdown(html)).toBe('# Hello\n\nA **small** test.')
  })

  it('supports tag overrides', () => {
    expect(htmlToMarkdown('<x-title>Hello</x-title>', {
      tagOverrides: { 'x-title': 'h2' },
    })).toBe('## Hello')
  })

  it('applies explicit plugins', () => {
    expect(htmlToMarkdown('<nav>hidden</nav><p>shown</p>', {
      plugins: [filterPlugin({ exclude: [TAG_NAV] })],
    })).toBe('shown')
  })

  it('keeps root-relative parent traversal inside the origin', () => {
    expect(htmlToMarkdown('<a href="../guide">Guide</a>', {
      origin: 'https://example.com/',
    })).toBe('[Guide](https://example.com/guide)')
  })

  it('streams without optional plugins', async () => {
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
})
