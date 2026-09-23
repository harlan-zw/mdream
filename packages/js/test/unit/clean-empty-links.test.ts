import { describe, expect, it } from 'vitest'
import { clean, slugify, stripHeadingFormatting } from '../../src/clean'
import { htmlToMarkdown } from '../../src/index'
import { withMinimalPreset } from '../../src/preset/minimal'

const executableHrefs = [
  'JavaScript:void(0)',
  'DATA:text/html,payload',
  'VbScRiPt:msgbox(1)',
]

describe('clean.emptyLinks executable schemes', () => {
  it.each(executableHrefs)('strips %s while serializing', (href) => {
    expect(htmlToMarkdown(`<a href="${href}">Click</a>`, {
      clean: clean({ emptyLinks: true }),
    })).toBe('Click')
  })
})

// Expected slugs come from the Rust core's `slugify_heading` tests.
describe('heading slugs match Rust', () => {
  it.each([
    ['Hello World', 'hello-world'],
    ['  Trim Me  ', 'trim-me'],
    ['Keep_Underscore', 'keepunderscore'],
    ['a -- b', 'a-b'],
    ['What\'s New?!', 'whats-new'],
    ['See [the docs](https://x.com)', 'see-the-docs'],
    ['*bold* and `code`', 'bold-and-code'],
    ['<a href="#section">Section</a>', 'section'],
    ['<http://x>', 'httpx'],
    [String.raw`\<span\>`, 'span'],
    ['`<span>`', 'span'],
    ['`foo_bar', 'foobar'],
    ['``foo_bar`', 'foobar'],
    ['``foo_bar``', 'foo_bar'],
    ['`` `foo_bar`', 'foo_bar'],
    ['`foo_bar<span title="`"></span>', 'foobar'],
    ['`foo_bar\\<span title="`"></span>', 'foo_barspan-title'],
    ['`foo_bar\\\\<span title="`"></span>', 'foobar'],
    ['\\`foo_bar', 'foobar'],
    ['`foo\\_bar', 'foo_bar'],
    ['`foo_bar\\`', 'foo_bar'],
    ['`foo_bar\\` baz_qux`', 'foo_bar-bazqux'],
  ])('%s', (heading, slug) => {
    expect(slugify(stripHeadingFormatting(heading))).toBe(slug)
  })

  it('handles repeated malformed tag starts', () => {
    expect(slugify(stripHeadingFormatting(`${'<a '.repeat(16 * 1024)}>`))).toMatch(/^[a-]+$/)
  })
})

describe('raw HTML cleaner boundaries', () => {
  it('encodes Markdown brackets in raw anchor attributes before cleanup', () => {
    expect(htmlToMarkdown(String.raw`<details>\<a href="[javascript:alert(1)](#)" title="[Title]">Click</a></details>`, {
      clean: clean(),
    })).toBe(String.raw`<details>\<a href="&#91;javascript:alert(1)&#93;(#)" title="&#91;Title&#93;">Click</a></details>`)
  })
})

describe('clean.fragments source marker characters', () => {
  it.each(['\uFDD0', '\uFDD1'])('keeps a source %s the pass did not write', (marker) => {
    const html = `<main><p>a&#x${marker.charCodeAt(0).toString(16).toUpperCase()};b</p></main>`
    expect(htmlToMarkdown(html, { clean: clean({ fragments: true }) })).toBe(`a${marker}b`)
    expect(htmlToMarkdown(html, withMinimalPreset())).toBe(`a${marker}b`)
  })

  it('keeps a source marker next to the links the pass rewrites', () => {
    const html = '<p>a&#xFDD0;b <a href="#missing">gone</a> <a href="#real">kept</a></p><h1>Real</h1>'
    expect(htmlToMarkdown(html, { clean: clean({ fragments: true }) })).toBe('a\uFDD0b gone [kept](#real)\n\n# Real')
  })
})
