import { describe, expect, it } from 'vitest'
import { TAG_NAV } from '../../src/const'
import { htmlToMarkdown, streamHtmlToMarkdown } from '../../src/index'
import { filterPlugin } from '../../src/plugins/filter'
import { withMinimalPreset } from '../../src/preset/minimal'
import { htmlToText } from '../../src/text'

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

describe('text conversion', () => {
  it.each([
    ['keeps the separator before a trailing empty cell', '<table><tr><td>a</td><td></td></tr><tr><td>b</td><td>c</td></tr></table>', 'a\t\nb\tc'],
    ['adds no space before an underscore after a block element', '<p>snake<x-v>_case</x-v></p>', 'snake_case'],
    ['drops an empty quotation', '<p>a<q></q>b</p>', 'a b'],
    ['drops the space after an empty caption break', 'a<figcaption><br></figcaption> b', 'a\nb'],
  ])('%s', (_name, html, expected) => {
    expect(htmlToText(html)).toBe(expected)
  })
})

describe('plugin reuse', () => {
  const pages = [
    '<html><head><title>A</title><meta name="description" content="da"></head><body><header>x</header><h1>A</h1><p>a</p><footer>f</footer></body></html>',
    '<html><head><title>B</title></head><body><h1>B</h1><p>b</p></body></html>',
    '<html><head><title>A</title></head><body><main><h1>A</h1><p>a</p></main></body></html>',
    '<html><head><title>C</title></head><body><h1>C</h1><p>c</p></body></html>',
  ]

  it('gives a reused preset the same output as a fresh one', () => {
    const shared = withMinimalPreset()
    for (const page of pages)
      expect(htmlToMarkdown(page, shared)).toBe(htmlToMarkdown(page, withMinimalPreset()))
  })

  it('keeps concurrent streams that share plugins apart', async () => {
    const shared = withMinimalPreset()
    const stream = (html: string) => new ReadableStream<string>({
      start(controller) {
        for (let index = 0; index < html.length; index += 16)
          controller.enqueue(html.slice(index, index + 16))
        controller.close()
      },
    })
    const collect = async (html: string) => {
      let output = ''
      for await (const chunk of streamHtmlToMarkdown(stream(html), shared))
        output += chunk
      return output
    }
    const outputs = await Promise.all(pages.map(collect))
    expect(outputs).toEqual(pages.map(page => htmlToMarkdown(page, withMinimalPreset({ clean: false }))))
  })
})
