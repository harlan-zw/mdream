import { describe, expect, it } from 'vitest'
import { cleanEmptyLinks, cleanFragments, cleanRedundantLinks, cleanSelfLinkHeadings } from '../../src/clean'
import { htmlToMarkdown } from '../../src/index'

const executableHrefs = [
  'JavaScript:void(0)',
  'DATA:text/html,payload',
  'VbScRiPt:msgbox(1)',
]

describe('clean.emptyLinks executable schemes', () => {
  it.each(executableHrefs)('strips %s while serializing', (href) => {
    expect(htmlToMarkdown(`<a href="${href}">Click</a>`, {
      clean: { emptyLinks: true },
    })).toBe('Click')
  })

  it.each(executableHrefs)('strips %s during post-processing', (href) => {
    expect(cleanEmptyLinks(`[Click](${href})`)).toBe('Click')
  })
})

describe('raw HTML cleaner boundaries', () => {
  it('requires an exact closing backtick run before preserving code content', () => {
    expect(cleanFragments('## `foo_bar\n\n[jump](#foobar)'))
      .toBe('## `foo_bar\n\n[jump](#foobar)')
    expect(cleanFragments('## ``foo_bar`\n\n[jump](#foobar)'))
      .toBe('## ``foo_bar`\n\n[jump](#foobar)')
    expect(cleanFragments('## ``foo_bar``\n\n[jump](#foo_bar)'))
      .toBe('## ``foo_bar``\n\n[jump](#foo_bar)')
    expect(cleanFragments('## `` `foo_bar`\n\n[jump](#foo_bar)'))
      .toContain('[jump](#foo_bar)')
    expect(cleanFragments('## `foo_bar<span title="`"></span>\n\n[jump](#foobar)'))
      .toContain('[jump](#foobar)')
    expect(cleanFragments('## `foo_bar\\<span title="`"></span>\n\n[jump](#foo_barspan-title)'))
      .toContain('[jump](#foo_barspan-title)')
    expect(cleanFragments('## `foo_bar\\\\<span title="`"></span>\n\n[jump](#foobar)'))
      .toContain('[jump](#foobar)')
    expect(cleanFragments('## \\`foo_bar\n\n[jump](#foobar)'))
      .toContain('[jump](#foobar)')
    expect(cleanFragments('## `foo\\_bar\n\n[jump](#foo_bar)'))
      .toContain('[jump](#foo_bar)')
    expect(cleanFragments('## `foo_bar\\`\n\n[jump](#foo_bar)'))
      .toContain('[jump](#foo_bar)')
    expect(cleanFragments('## `foo_bar\\` baz_qux`\n\n[jump](#foo_bar-bazqux)'))
      .toContain('[jump](#foo_bar-bazqux)')
  })

  it('cleans Markdown inside escaped tag-shaped text outside raw HTML', () => {
    expect(cleanFragments(String.raw`\<a title="[jump](#missing)">`))
      .toBe(String.raw`\<a title="jump">`)
    expect(cleanRedundantLinks(String.raw`\<https://example.com>`))
      .toBe(String.raw`\<https://example.com>`)
  })

  it('cleans a self-link heading inside escaped tag-shaped text', () => {
    const markdown = String.raw`\<a title="line one
## [Title](#title)">Click</a>`
    expect(cleanSelfLinkHeadings(markdown)).toBe(String.raw`\<a title="line one
## Title">Click</a>`)
  })

  it('encodes Markdown brackets in raw anchor attributes before cleanup', () => {
    expect(htmlToMarkdown(String.raw`<details>\<a href="[javascript:alert(1)](#)" title="[Title]">Click</a></details>`, {
      clean: true,
    })).toBe(String.raw`<details>\<a href="&#91;javascript:alert(1)&#93;(#)" title="&#91;Title&#93;">Click</a></details>`)
  })

  it('handles repeated malformed tag starts', () => {
    const markdown = `${'<a '.repeat(16 * 1024)}>`
    expect(cleanEmptyLinks(markdown)).toBe(markdown)
  })
})
