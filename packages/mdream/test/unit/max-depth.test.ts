import { describe, expect, it } from 'vitest'
import { htmlToMarkdown, streamHtmlToMarkdown } from '../../src/index.js'

async function collect(stream: AsyncIterable<string>): Promise<string> {
  let output = ''
  for await (const chunk of stream)
    output += chunk
  return output
}

describe('maxDepth', () => {
  it('passes the option to the native converter', () => {
    expect(htmlToMarkdown('<div><strong>deep</strong></div>', { maxDepth: 1 }))
      .toBe('deep')
  })

  it('passes the option to the streaming converter', async () => {
    const html = new ReadableStream<string>({
      start(controller) {
        controller.enqueue('<div><strong>de')
        controller.enqueue('ep</strong></div>')
        controller.close()
      },
    })
    expect((await collect(streamHtmlToMarkdown(html, { maxDepth: 1 }))).trimEnd())
      .toBe('deep')
  })
})
