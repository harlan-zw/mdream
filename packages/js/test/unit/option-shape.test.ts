import { describe, expect, it } from 'vitest'
import { htmlToSafeHtml, streamHtmlToSafeHtml } from '../../src/html'
import { htmlToMarkdown, streamHtmlToMarkdown } from '../../src/index'
import { frontmatterPlugin } from '../../src/plugins/frontmatter'
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
  })

  it('accepts a plugin array and top-level tag overrides', () => {
    const page = '<head><title>T</title></head><x-h>Hi</x-h>'
    const options = { plugins: [frontmatterPlugin()], tagOverrides: { 'x-h': 'h2' } }
    expect(htmlToMarkdown(page, options)).toBe('---\ntitle: T\n---\n\n## Hi')
    expect(htmlToText(page, options)).toBe('Hi')
  })
})
