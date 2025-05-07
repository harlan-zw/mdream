import { describe, expect, it } from 'vitest'
import { syncHtmlToMarkdown } from '../../src'

describe('pretty', () => {
  it.skip('subsequent a', () => {
    const html = `<div><a href="b">a</a><a href="a">b</a></div>`
    const markdown = syncHtmlToMarkdown(html)
    expect(markdown).toMatchInlineSnapshot(`"[a](b) [b](a)"`)
  })
})
