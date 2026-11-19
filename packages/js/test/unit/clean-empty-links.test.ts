import { describe, expect, it } from 'vitest'
import { clean, slugify, stripHeadingFormatting } from '../../src/clean'
import { ELEMENT_NODE, MAX_TAG_ID, TAG_A } from '../../src/const'
import { htmlToMarkdown } from '../../src/index'
import { createOutputPositions } from '../../src/output-positions'
import { tailwindPlugin } from '../../src/plugins/tailwind'
import { withMinimalPreset } from '../../src/preset/minimal'

const executableHrefs = [
  'JavaScript:void(0)',
  'DATA:text/html,payload',
  'VbScRiPt:msgbox(1)',
]

it('maps content and boundary positions across an unwrapped closer reference', () => {
  const buffer = ['**b!**', '[']
  const depthMap = new Uint16Array(MAX_TAG_ID)
  const outputPositions = createOutputPositions(buffer)
  const target = { buffer, depthMap, outputPositions, lastContentCache: '' }
  const pass = clean({ redundantLinks: true }).apply(target)!
  const link = { type: ELEMENT_NODE, name: 'a', tagId: TAG_A, attributes: { href: 'cat!' }, depthMap, depth: 0, index: 0 }
  pass.enter(link, 1, 42)
  buffer.push('cat', '!')
  const positions = [[0, 6], [1, 0], [1, 1], [2, 0], [2, 1], [2, 3], [3, 0], [3, 1]].flatMap(([fragment, offset]) =>
    (['boundary', 'content'] as const).map(kind =>
      outputPositions.capture(fragment, offset, kind)))
  pass.exit(link)
  expect(pass.unwrap(link)).toBe(true)
  expect(buffer.join('')).toBe('**b!**&#99;at!')
  expect(target.lastContentCache).toBe('&#99;at!')
  const resolve = outputPositions.finish()
  expect(positions.map(resolve)).toEqual([6, 6, 6, 6, 6, 6, 6, 6, 11, 11, 13, 13, 13, 13, 14, 14])
})

describe('clean.emptyLinks executable schemes', () => {
  it('uses the current cleanup rules for each conversion', () => {
    const cleaner = clean({ fragments: true })
    expect(htmlToMarkdown('<a href="#missing">x</a>', { clean: cleaner })).toBe('x')
    cleaner.fragments = false
    expect(htmlToMarkdown('<a href="#missing">x</a>', { clean: cleaner })).toBe('[x](#missing)')
  })

  it('uses updated cleanup rules in serialization and post-processing', () => {
    const cleaner = clean({ emptyLinks: true })
    cleaner.emptyLinks = false
    expect(htmlToMarkdown('<a href="#">Click</a>', { clean: cleaner })).toBe('[Click](#)')
    cleaner.emptyLinks = true
    expect(htmlToMarkdown('<a href="#">Click</a>', { clean: cleaner })).toBe('Click')
  })

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
  it.each([
    '<blockquote><blockquote><a href="#x">a<br>b</a></blockquote></blockquote>',
    '<ul><li><blockquote><a href="#x">a<br>b</a></blockquote></li></ul>',
    '<blockquote><a href="#x"><code>a`b</code><br>c</a></blockquote>',
  ])('keeps cleanup independent of a source marker beside %s', (body) => {
    const options = { clean: clean({ fragments: true }) }
    expect(htmlToMarkdown(`<p>&#xFDD0;</p>${body}`, options)).toBe(htmlToMarkdown(`<p>z</p>${body}`, options).replace('z', '\uFDD0'))
  })
  it.each([
    ['<blockquote><a href="#x">a<br>b</a></blockquote>', '\uFDD0\n\n> a  \n> b'],
    ['<blockquote><h2>X</h2><a href="#x">a<br>b</a></blockquote>', '\uFDD0\n\n> ## X\n>\n> [a  \n> b](#x)'],
  ])('resolves transformed links beside source markers: %s', (body, expected) => {
    expect(htmlToMarkdown(`<p>&#xFDD0;</p>${body}`, { clean: clean({ fragments: true }) })).toBe(expected)
  })
  it.each(['\uFDD0', '\uFDD1'])('keeps a source %s the pass did not write', (marker) => {
    const html = `<main><p>a&#x${marker.charCodeAt(0).toString(16).toUpperCase()};b</p></main>`
    expect(htmlToMarkdown(html, { clean: clean({ fragments: true }) })).toBe(`a${marker}b`)
    expect(htmlToMarkdown(html, withMinimalPreset())).toBe(`a${marker}b`)
  })

  it('keeps a source marker next to the links the pass rewrites', () => {
    const html = '<p>a&#xFDD0;b <a href="#missing">gone</a> <a href="#real">kept</a></p><h1>Real</h1>'
    expect(htmlToMarkdown(html, { clean: clean({ fragments: true }) })).toBe('a\uFDD0b gone [kept](#real)\n\n# Real')
  })

  it('keeps a source open marker before link syntax in code output', () => {
    const html = '<pre><code>&#xFDD0;[x](#y)</code></pre>'
    expect(htmlToMarkdown(html, { clean: clean({ fragments: true }) })).toContain('\uFDD0')
  })

  it('keeps a source close marker next to link syntax in code output', () => {
    const html = '<p><a href="#zz">g</a></p><pre><code>&#xFDD1;](#x)</code></pre>'
    expect(htmlToMarkdown(html, { clean: clean({ fragments: true }) })).toContain('\uFDD1')
  })

  it('keeps source markers in code while still dropping the written ones', () => {
    const html = '<pre><code>&#xFDD0;[x](#y)</code></pre><p><a href="#real">kept</a></p><h1>Real</h1>'
    const md = htmlToMarkdown(html, { clean: clean({ fragments: true }) })
    expect(md).toContain('\uFDD0[x](#y)')
    expect(md).toContain('[kept](#real)')
    expect(md).not.toContain('\uFDD1')
  })

  it('keeps code whose bytes match a span the pass wrote', () => {
    const html = '<pre><code>&#xFDD0;[x&#xFDD1;](#y)</code></pre><p><a href="#y">x</a></p>'
    const md = htmlToMarkdown(html, { clean: clean({ fragments: true }) })
    expect(md).toContain('```\n\uFDD0[x\uFDD1](#y)\n```')
    expect(md).not.toContain('```\nx\n```')
  })

  it('keeps inline code whose bytes match a span the pass wrote', () => {
    const html = '<p><code>&#xFDD0;[x&#xFDD1;](#y)</code></p><p><a href="#y">x</a></p>'
    const md = htmlToMarkdown(html, { clean: clean({ fragments: true }) })
    expect(md).toContain('`\uFDD0[x\uFDD1](#y)`')
  })

  it('drops a broken link whose destination carries a source marker whole', () => {
    const html = '<p><a href="#a\uFDD1b">x</a></p>'
    expect(htmlToMarkdown(html, { clean: clean({ fragments: true }) })).toBe('x')
  })

  it('drops a broken link whose destination carries a source open marker whole', () => {
    const html = '<p><a href="#a\uFDD0b">x</a></p>'
    expect(htmlToMarkdown(html, { clean: clean({ fragments: true }) })).toBe('x')
  })

  it('drops a broken link whose title carries a source marker whole', () => {
    const html = '<p><a href="#a" title="t\uFDD1b">x</a></p>'
    expect(htmlToMarkdown(html, { clean: clean({ fragments: true }) })).toBe('x')
  })
})

describe('tailwind Unicode class separators', () => {
  it.each(['\u0085', '\u00A0', '\u1680', '\u2000', '\u2007', '\u2028', '\u2029', '\u202F', '\u205F', '\u3000'])('splits classes on U+%s', (separator) => {
    expect(htmlToMarkdown(`<p class="font-bold${separator}italic">x</p>`, { plugins: [tailwindPlugin()] })).toBe('***x***')
  })
})
