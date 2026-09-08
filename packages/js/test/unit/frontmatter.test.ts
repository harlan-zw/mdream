import { describe, expect, it } from 'vitest'
import { htmlToMarkdown } from '../../src/index'
import { frontmatterPlugin } from '../../src/plugins/frontmatter'

describe('frontmatter plugin', () => {
  it('passes raw quotes and backslashes to onExtract', () => {
    let extracted: Record<string, string> | undefined
    const value = String.raw`foo"bar\baz`
    const html = String.raw`<head><title>foo"bar\baz</title><meta name="description" content='foo"bar\baz'></head>`

    htmlToMarkdown(html, {
      plugins: [frontmatterPlugin({ onExtract: (value) => { extracted = value } })],
    })

    expect(extracted?.title).toBe(value)
    expect(extracted?.description).toBe(value)
  })
})
