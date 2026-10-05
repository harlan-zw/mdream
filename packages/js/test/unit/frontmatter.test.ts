import { describe, expect, it } from 'vitest'
import { htmlToMarkdown, streamHtmlToMarkdown } from '../../src/index'
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

  it.each([
    ['an element before the head', '<html><script>x</script><head><title>T</title><meta name="description" content="D"></head>', [{ title: 'T', description: 'D' }]],
    ['a late head', '<p>hi</p><head><title>Late</title></head>', [{ title: 'Late' }]],
    ['two heads', '<head><title>First</title></head><head><title>Second</title></head>', [{ title: 'Second' }]],
  ])('calls onExtract once after conversion for %s', (_name, html, expected) => {
    const calls: Record<string, string>[] = []
    htmlToMarkdown(html, { plugins: [frontmatterPlugin({ onExtract: fm => calls.push(fm) })] })
    expect(calls).toEqual(expected)
  })

  it('passes additional fields to onExtract for text-only input', () => {
    const calls: Record<string, string>[] = []
    htmlToMarkdown('plain text only', {
      plugins: [frontmatterPlugin({ additionalFields: { site: 'S' }, onExtract: fm => calls.push(fm) })],
    })
    expect(calls).toEqual([{ site: 'S' }])
  })

  it('calls onExtract when a stream ends', async () => {
    const calls: Record<string, string>[] = []
    const stream = new ReadableStream<string>({
      start(controller) {
        controller.enqueue('<head><title>T</title></head>')
        controller.enqueue('<p>x</p>')
        controller.close()
      },
    })
    for await (const _ of streamHtmlToMarkdown(stream, { plugins: [frontmatterPlugin({ onExtract: fm => calls.push(fm) })] })) {
      // drain
    }
    expect(calls).toEqual([{ title: 'T' }])
  })
})
