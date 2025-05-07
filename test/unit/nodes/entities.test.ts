import { describe, expect, it } from 'vitest'
import { syncHtmlToMarkdown } from '../../../src'

describe('html Entities', () => {
  it('decodes common HTML entities', () => {
    const html = '<p>&lt;div&gt; &amp; &quot;quotes&quot; &apos;apostrophes&apos;</p>'
    const markdown = syncHtmlToMarkdown(html)
    expect(markdown).toBe('<div> & "quotes" \'apostrophes\'')
  })

  it('decodes numeric entities', () => {
    const html = '<p>&#169; &#8212; &#x1F600;</p>'
    const markdown = syncHtmlToMarkdown(html)
    expect(markdown).toBe('© — 😀')
  })
})
