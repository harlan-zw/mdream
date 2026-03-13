import { describe, expect, it } from 'vitest'
import { engines, htmlToMarkdown, resolveEngine } from '../../utils/engines'

describe.each(engines)('html Entities $name', (engineConfig) => {
  it('decodes common HTML entities', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = '<p>&lt;div&gt; &amp; &quot;quotes&quot; &apos;apostrophes&apos;</p>'
    const markdown = htmlToMarkdown(html, { engine }).markdown
    expect(markdown).toBe('<div> & "quotes" \'apostrophes\'')
  })

  it('decodes numeric entities', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = '<p>&#169; &#8212; &#x1F600;</p>'
    const markdown = htmlToMarkdown(html, { engine }).markdown
    expect(markdown).toBe('© — 😀')
  })
})
