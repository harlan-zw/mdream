import { describe, expect, it } from 'vitest'
import { syncHtmlToMarkdown } from '../../../src'

describe('minimal-from-first-header', () => {
  it('ignores non-minimal tags', () => {
    // footer, nav, aside, etc
    const html = `<div>this should be ignored</div><h1>hello world</h1><div>foo</div>`
    const markdown = syncHtmlToMarkdown(html, {
      strategy: 'minimal-from-first-header',
    })
    expect(markdown).toMatchInlineSnapshot(`
      "# hello world

      foo"
    `)
  })
})
