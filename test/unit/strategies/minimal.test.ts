import { describe, expect, it } from 'vitest'
import { syncHtmlToMarkdown } from '../../../src'

describe('minimal', () => {
  it('ignores non-minimal tags', () => {
    // footer, nav, aside, etc
    const html = `<footer>Footer content<div>should be ignored</div></footer><nav>Nav content<ul><li>ignore me</li></ul></nav><aside>Aside content</aside><div>foo</div>`
    const markdown = syncHtmlToMarkdown(html, {
      strategy: 'minimal',
    })
    expect(markdown).toMatchInlineSnapshot(`"foo"`)
  })
})
