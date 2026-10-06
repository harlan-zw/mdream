import { describe, expect, it } from 'vitest'
import { clean } from '../../src/clean'
import { htmlToSafeHtml, streamHtmlToSafeHtml } from '../../src/html'
import { htmlToMarkdown, streamHtmlToMarkdown } from '../../src/index'
import { createPlugin } from '../../src/pluggable/plugin'
import { frontmatterPlugin } from '../../src/plugins/frontmatter'
import { htmlToMarkdownSplitChunks } from '../../src/splitter'
import { htmlToText, streamHtmlToText } from '../../src/text'

const converters = [
  ['htmlToMarkdown', htmlToMarkdown, streamHtmlToMarkdown],
  ['htmlToText', htmlToText, streamHtmlToText],
  ['htmlToSafeHtml', htmlToSafeHtml, streamHtmlToSafeHtml],
] as const

// The mdream (Rust) entry takes these options at the top level, and @mdream/js
// v1 took `format`, `hooks`, and a `plugins` object. @mdream/js reads none of
// them, so each would silently do nothing.
describe('options @mdream/js does not read', () => {
  it('rejects removed splitter options before setting up plugins', () => {
    let calls = 0
    const plugin = createPlugin(() => {
      calls++
      return {}
    })
    expect(() => htmlToMarkdownSplitChunks('<p>x</p>', { format: 'text', plugins: [plugin] } as any)).toThrow('format')
    expect(calls).toBe(0)
  })

  it('sets up each splitter plugin once per conversion', () => {
    let calls = 0
    const plugin = createPlugin(() => {
      calls++
      return {}
    })
    expect(htmlToMarkdownSplitChunks('<p>x</p>', { plugins: [plugin] }).map(chunk => chunk.content)).toEqual(['x'])
    expect(calls).toBe(1)
  })

  const rejected: Record<string, unknown>[] = [
    { minimal: true },
    { format: 'text' },
    { hooks: [] },
    { frontmatter: true },
    { isolateMain: true },
    { tailwind: true },
    { filter: { exclude: ['nav'] } },
    { extraction: {} },
    { plugins: { frontmatter: true } },
    { preset: 'minimal' },
    { cleanUrls: true },
    { isolatemain: true },
    { chunkSize: 100 },
  ]

  it.each(converters)('%s rejects them', (_name, convert, stream) => {
    for (const options of rejected) {
      expect(() => convert('<p>x</p>', options as any), JSON.stringify(options)).toThrow(TypeError)
      expect(() => stream(new ReadableStream(), options as any), JSON.stringify(options)).toThrow(TypeError)
    }
  })

  it('names the fix', () => {
    expect(() => htmlToMarkdown('<p>x</p>', { minimal: true } as any)).toThrow('withMinimalPreset')
    expect(() => htmlToMarkdown('<p>x</p>', { frontmatter: true } as any)).toThrow('{ plugins: [frontmatterPlugin()] }')
    expect(() => htmlToMarkdown('<p>x</p>', { format: 'text' } as any)).toThrow('@mdream/js/text')
    expect(() => htmlToMarkdown('<p>x</p>', { plugins: { frontmatter: true } } as any)).toThrow('as an array')
    expect(() => htmlToMarkdown('<p>x</p>', { preset: 'minimal' } as any)).toThrow('@mdream/js has no `preset` option. Use withMinimalPreset()')
    expect(() => htmlToMarkdown('<p>x</p>', { cleanUrls: true } as any)).toThrow('{ clean: clean({ urls: true }) }')
    expect(() => htmlToMarkdown('<p>x</p>', { isolatemain: true } as any)).toThrow('@mdream/js has no `isolatemain` option. Valid options: origin, tagOverrides, clean, wrapWidth, plugins.')
  })

  it.each(converters)('%s ignores keys whose value is undefined', (_name, convert) => {
    expect(convert('<p>x</p>', { minimal: undefined, preset: undefined, plugins: undefined } as any)).toBe(convert('<p>x</p>'))
  })

  it('accepts splitter options only in the splitter', () => {
    const html = '<h2>One</h2><p>Alpha beta gamma.</p><h2>Two</h2><p>Delta.</p>'
    const chunks = htmlToMarkdownSplitChunks(html, { chunkSize: 1000, chunkOverlap: 0, stripHeaders: false, minimal: undefined } as any)
    expect(chunks.map(chunk => chunk.content)).toEqual(['## One\n\nAlpha beta gamma.', '## Two\n\nDelta.'])
    expect(() => htmlToMarkdownSplitChunks(html, { chunksize: 20 } as any)).toThrow('@mdream/js has no `chunksize` option.')
    expect(() => htmlToMarkdownSplitChunks(html, { chunksize: 20 } as any)).toThrow('chunkSize')
    expect(() => htmlToMarkdown(html, { chunkSize: 20 } as any)).toThrow('@mdream/js has no `chunkSize` option.')
  })

  it('accepts a plugin array and top-level tag overrides', () => {
    const page = '<head><title>T</title></head><x-h>Hi</x-h>'
    const options = { plugins: [frontmatterPlugin()], tagOverrides: { 'x-h': 'h2' } }
    expect(htmlToMarkdown(page, options)).toBe('---\ntitle: T\n---\n\n## Hi')
    expect(htmlToText(page, options)).toBe('Hi')
  })
})

describe('clean urls in text and safe HTML', () => {
  it('drops tracking parameters and keeps the others', () => {
    const options = { clean: clean({ urls: true }), origin: 'https://example.com' }
    expect(htmlToText('<img src="/i.png?utm_source=a&amp;w=10&amp;fbclid=b">', options)).toBe('https://example.com/i.png?w=10')
    expect(htmlToSafeHtml('<a href="/x?utm_medium=b&amp;id=2">x</a>', options)).toBe('<a href="https://example.com/x?id=2">x</a>')
  })

  // URL cleanup lives in clean(), so a plain rules object would silently
  // skip it. Every entry names the fix instead.
  it.each(converters)('%s rejects rules that did not come from clean()', (_name, convert, stream) => {
    const options = { clean: { urls: true } as any }
    expect(() => convert('<p>x</p>', options)).toThrow('@mdream/js/clean')
    expect(() => stream(new ReadableStream(), options)).toThrow('@mdream/js/clean')
  })
})
