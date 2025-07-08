import { describe, expect, it } from 'vitest'
import { htmlToMarkdown } from '../../../src'

describe('html Entities', () => {
  it('decodes common HTML entities', () => {
    const html = '<p>&lt;div&gt; &amp; &quot;quotes&quot; &apos;apostrophes&apos;</p>'
    const markdown = htmlToMarkdown(html)
    expect(markdown).toBe('<div> & "quotes" \'apostrophes\'')
  })

  it('decodes numeric entities', () => {
    const html = '<p>&#169; &#8212; &#x1F600;</p>'
    const markdown = htmlToMarkdown(html)
    expect(markdown).toBe('© — 😀')
  })
})
