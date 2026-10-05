import { describe, expect, it } from 'vitest'
import { htmlToMarkdown as nativeHtmlToMarkdown } from '../../../mdream/src'
import { htmlToSafeHtml, streamHtmlToSafeHtml } from '../../src/html'
import { htmlToMarkdown, streamHtmlToMarkdown } from '../../src/index'
import { htmlToText, streamHtmlToText } from '../../src/text'

async function streamBytes(html: string): Promise<string> {
  const bytes = new TextEncoder().encode(html)
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (let index = 0; index < bytes.length; index++)
        controller.enqueue(bytes.subarray(index, index + 1))
      controller.close()
    },
  })
  let markdown = ''
  for await (const chunk of streamHtmlToMarkdown(stream))
    markdown += chunk
  return markdown
}

describe('streaming UTF-8', () => {
  it.each(['\uFEFF<p>x</p>', '\uFEFF<p>é漢字🎉</p>', '\uFEFF<h2>Title</h2><p>tail</p>'])('preserves a leading BOM across byte boundaries: %s', async (html) => {
    const bytes = new TextEncoder().encode(html)
    for (const size of [1, 2, 3, 7, bytes.length]) {
      const input = new ReadableStream<Uint8Array | string>({
        start(controller) {
          controller.enqueue('')
          for (let index = 0; index < bytes.length; index += size) {
            controller.enqueue(bytes.subarray(index, index + size))
            controller.enqueue(new Uint8Array())
            controller.enqueue('')
          }
          controller.close()
        },
      })
      let output = ''
      for await (const chunk of streamHtmlToMarkdown(input))
        output += chunk
      expect(output).toBe(htmlToMarkdown(html))
      expect(output).toBe(nativeHtmlToMarkdown(html))
    }
  })

  it('keeps replacement characters after a split BOM and invalid UTF-8', async () => {
    const bytes = new Uint8Array([239, 187, 191, 60, 112, 62, 195, 40, 255, 60, 47, 112, 62])
    const input = new ReadableStream<Uint8Array>({
      start(controller) {
        for (const byte of bytes)
          controller.enqueue(new Uint8Array([byte]))
        controller.close()
      },
    })
    let output = ''
    for await (const chunk of streamHtmlToMarkdown(input))
      output += chunk
    expect(output).toBe(htmlToMarkdown('\uFEFF<p>\uFFFD(\uFFFD</p>'))
  })
  const formats = [
    ['markdown', htmlToMarkdown, streamHtmlToMarkdown],
    ['text', htmlToText, streamHtmlToText],
    ['html', htmlToSafeHtml, streamHtmlToSafeHtml],
  ] as const

  it.each(formats)('preserves split UTF-8 around empty strings in %s', async (_name, convert, streamConvert) => {
    const bytes = new TextEncoder().encode('<p>é</p>')
    const input = new ReadableStream<Uint8Array | string>({
      start(controller) {
        controller.enqueue(bytes.subarray(0, 4))
        controller.enqueue('')
        controller.enqueue(bytes.subarray(4))
        controller.close()
      },
    })
    let output = ''
    for await (const chunk of streamConvert(input))
      output += chunk
    expect(output.trim()).toBe(convert('<p>é</p>').trim())
  })

  it.each(formats)('preserves later byte order marks after strings in %s', async (_name, convert, streamConvert) => {
    const html = '<p>before\uFEFFafter</p>'
    const input = new ReadableStream<Uint8Array | string>({
      start(controller) {
        controller.enqueue('<p>before')
        controller.enqueue(new TextEncoder().encode('\uFEFFafter</p>'))
        controller.close()
      },
    })
    let output = ''
    for await (const chunk of streamConvert(input))
      output += chunk
    expect(output.trim()).toBe(convert(html).trim())
  })
  it.each([
    [htmlToMarkdown, streamHtmlToMarkdown],
    [htmlToText, streamHtmlToText],
    [htmlToSafeHtml, streamHtmlToSafeHtml],
  ])('preserves BOM characters after mixed chunk boundaries', async (convert, streamConvert) => {
    const bom = new Uint8Array([239, 187, 191])
    for (const chunks of [
      ['<p>a', bom, 'b</p>'],
      [new TextEncoder().encode('<p>a'), '', bom, 'b</p>'],
      ['<p>a', bom.subarray(0, 1), bom.subarray(1), 'b</p>'],
    ]) {
      const stream = new ReadableStream<string | Uint8Array>({
        start(controller) {
          for (const chunk of chunks)
            controller.enqueue(chunk)
          controller.close()
        },
      })
      let output = ''
      for await (const chunk of streamConvert(stream))
        output += chunk
      expect(output).toBe(convert('<p>a\uFEFFb</p>'))
    }
  })

  it.each([
    '<blockquote>”<br>\n</><p>🎉',
    '<a href="/x">link</a>“<strong></strong>—漢字',
    '<ul><li>é<a href="/x"></a>…</li></ul>🎉&mdash;',
  ])('matches one-shot output for %s', async (html) => {
    expect((await streamBytes(html)).trim()).toBe(htmlToMarkdown(html).trim())
  })
})
