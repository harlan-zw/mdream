import { describe, expect, it } from 'vitest'
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
    '<blockquote>”<br>\n</><p>🎉',
    '<a href="/x">link</a>“<strong></strong>—漢字',
    '<ul><li>é<a href="/x"></a>…</li></ul>🎉&mdash;',
  ])('matches one-shot output for %s', async (html) => {
    expect((await streamBytes(html)).trim()).toBe(htmlToMarkdown(html).trim())
  })
})
