import { describe, expect, it } from 'vitest'
import { asyncHtmlToMarkdown } from '../../../src'

describe('html Entities', async () => {
  it('decodes common HTML entities', async () => {
    const html = '<p>&lt;div&gt; &amp; &quot;quotes&quot; &apos;apostrophes&apos;</p>'
    const markdown = await asyncHtmlToMarkdown(html)
    expect(markdown).toBe('<div> & "quotes" \'apostrophes\'')
  })

  it('decodes numeric entities', async () => {
    const html = '<p>&#169; &#8212; &#x1F600;</p>'
    const markdown = await asyncHtmlToMarkdown(html)
    expect(markdown).toBe('© — 😀')
  })
})
