import { describe, expect, it } from 'vitest'
import { htmlToMarkdown } from '../../../src'

describe('pretty', () => {
  it.skip('subsequent a', () => {
    const html = `<div><a href="b">a</a><a href="a">b</a></div>`
    const markdown = htmlToMarkdown(html)
    expect(markdown).toMatchInlineSnapshot(`"[a](b) [b](a)"`)
  })
})
