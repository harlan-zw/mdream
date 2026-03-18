import { describe, expect, it } from 'vitest'
import { htmlToMarkdown as jsHtmlToMarkdown } from '@mdream/js'
import { engines, htmlToMarkdown, resolveEngine } from '../../utils/engines'

describe.each(engines)('html Entities $name', (engineConfig) => {
  it('decodes common HTML entities', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = '<p>&lt;div&gt; &amp; &quot;quotes&quot; &apos;apostrophes&apos;</p>'
    const markdown = htmlToMarkdown(html, { engine })
    expect(markdown).toBe('<div> & "quotes" \'apostrophes\'')
  })

  it('decodes numeric entities', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = '<p>&#169; &#8212; &#x1F600;</p>'
    const markdown = htmlToMarkdown(html, { engine })
    expect(markdown).toBe('© — 😀')
  })
})

describe('named HTML entities (JS engine)', () => {
  it('decodes typography entities', () => {
    expect(jsHtmlToMarkdown('<p>&mdash;&ndash;&hellip;&bull;</p>')).toBe('—–…•')
    expect(jsHtmlToMarkdown('<p>&lsquo;x&rsquo;</p>')).toBe('\u2018x\u2019')
    expect(jsHtmlToMarkdown('<p>&ldquo;x&rdquo;</p>')).toBe('\u201Cx\u201D')
    expect(jsHtmlToMarkdown('<p>&laquo;x&raquo;</p>')).toBe('«x»')
  })

  it('decodes accented latin characters', () => {
    expect(jsHtmlToMarkdown('<p>caf&eacute;</p>')).toBe('café')
    expect(jsHtmlToMarkdown('<p>&ntilde;</p>')).toBe('ñ')
    expect(jsHtmlToMarkdown('<p>na&iuml;ve</p>')).toBe('naïve')
  })

  it('decodes symbol entities', () => {
    expect(jsHtmlToMarkdown('<p>&copy; 2024</p>')).toBe('© 2024')
    expect(jsHtmlToMarkdown('<p>&reg;</p>')).toBe('®')
    expect(jsHtmlToMarkdown('<p>&trade;</p>')).toBe('™')
    expect(jsHtmlToMarkdown('<p>&euro;100</p>')).toBe('€100')
    expect(jsHtmlToMarkdown('<p>&pound;</p>')).toBe('£')
  })

  it('decodes math and arrow entities', () => {
    expect(jsHtmlToMarkdown('<p>a &ne; b</p>')).toBe('a ≠ b')
    expect(jsHtmlToMarkdown('<p>&larr; &rarr;</p>')).toBe('← →')
    expect(jsHtmlToMarkdown('<p>&infin;</p>')).toBe('∞')
    expect(jsHtmlToMarkdown('<p>&times;</p>')).toBe('×')
  })

  it('decodes greek letters', () => {
    expect(jsHtmlToMarkdown('<p>&alpha;&beta;&gamma;</p>')).toBe('αβγ')
    expect(jsHtmlToMarkdown('<p>&pi;r&sup2;</p>')).toBe('πr²')
  })

  it('passes through unknown named entities', () => {
    expect(jsHtmlToMarkdown('<p>&nonexistent;</p>')).toBe('&nonexistent;')
  })

  it('caps numeric entity digit scan', () => {
    expect(jsHtmlToMarkdown('<p>&#x10FFFF;</p>')).toBe('\u{10FFFF}')
    expect(jsHtmlToMarkdown('<p>&#99999999999;</p>')).toBe('&#99999999999;')
  })
})
