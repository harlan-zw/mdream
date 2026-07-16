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
    const stream = new ReadableStream<string>({
      start(controller) {
        controller.enqueue('<h1>Hello</h1>')
        controller.close()
      },
    })
    let markdown = ''
    for await (const chunk of streamHtmlToMarkdown(stream))
      markdown += chunk
    expect(markdown).toBe('# Hello\n\n')
  })
})
