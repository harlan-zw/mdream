import { describe, expect, it } from 'vitest'
import { htmlToMarkdown, streamHtmlToMarkdown } from '../../src/index'

// The mdream (Rust) entry takes plugin options at the top level. @mdream/js
// reads them from `plugins` only, so a top-level one would do nothing.
describe('top-level mdream options', () => {
  it.each(['minimal', 'frontmatter', 'isolateMain', 'tailwind', 'filter', 'extraction', 'tagOverrides'])('rejects %s at the top level', (key) => {
    const options = { [key]: true } as any
    expect(() => htmlToMarkdown('<p>x</p>', options)).toThrow(TypeError)
    expect(() => streamHtmlToMarkdown(new ReadableStream(), options)).toThrow(TypeError)
  })

  it('names the fix', () => {
    expect(() => htmlToMarkdown('<p>x</p>', { minimal: true } as any)).toThrow('withMinimalPreset')
    expect(() => htmlToMarkdown('<p>x</p>', { frontmatter: true } as any)).toThrow('{ plugins: { frontmatter } }')
  })

  it('accepts the plugins shape', () => {
    expect(htmlToMarkdown('<p>x</p>', { plugins: { frontmatter: true } })).toBe('x')
  })
})
