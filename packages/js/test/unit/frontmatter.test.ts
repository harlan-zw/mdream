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

  it('passes additional fields to onExtract when the document has no head', () => {
    const calls: Record<string, string>[] = []
    htmlToMarkdown('<p>x</p>', {
      plugins: [frontmatterPlugin({ additionalFields: { site: 'S' }, onExtract: fm => calls.push(fm) })],
    })
    expect(calls).toEqual([{ site: 'S' }])
  })

  it('calls onExtract once for a document with a head', () => {
    const calls: Record<string, string>[] = []
    htmlToMarkdown('<html><head><title>T</title></head><body><p>x</p></body></html>', {
      plugins: [frontmatterPlugin({ onExtract: fm => calls.push(fm) })],
    })
    expect(calls).toEqual([{ title: 'T' }])
  })
})
