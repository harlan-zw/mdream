import { describe, expect, it } from 'vitest'
import { htmlToMarkdown, streamHtmlToMarkdown } from '../../src/index'

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
  it.each([
    '<blockquote>”<br>\n</><p>🎉',
    '<a href="/x">link</a>“<strong></strong>—漢字',
    '<ul><li>é<a href="/x"></a>…</li></ul>🎉&mdash;',
  ])('matches one-shot output for %s', async (html) => {
    expect((await streamBytes(html)).trim()).toBe(htmlToMarkdown(html).trim())
  })
})
