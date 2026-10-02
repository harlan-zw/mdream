import { describe, expect, it } from 'vitest'
import { htmlToSafeHtml, streamHtmlToSafeHtml } from '../../src/html'
import { htmlToMarkdown, streamHtmlToMarkdown } from '../../src/index'
import { frontmatterPlugin } from '../../src/plugins/frontmatter'
import { htmlToText, streamHtmlToText } from '../../src/text'

async function drain(output: AsyncIterable<string>): Promise<string> {
  let result = ''
  for await (const chunk of output)
    result += chunk
  return result
}

function chunked(chunks: string[]): ReadableStream<string> {
  return new ReadableStream<string>({
    start(controller) {
      for (const chunk of chunks)
        controller.enqueue(chunk)
      controller.close()
    },
  })
}

// `<title>` is document metadata that browsers never render. The frontmatter
// plugin reads it; without the plugin it leaves no text, as in the Rust engine.
describe('<title>', () => {
  const page = '<html><head><title>Page</title></head><body><p>Body</p></body></html>'

  it('is dropped without frontmatter', async () => {
    expect(htmlToMarkdown(page)).toBe('Body')
    expect(htmlToText(page)).toBe('Body')
    expect(htmlToSafeHtml(page)).toBe('<p>Body</p>')
    expect(htmlToMarkdown('<p>a</p><title>T</title><p>b</p>')).toBe('a\n\nb')
    for (const split of [1, 5, 20]) {
      const chunks = [page.slice(0, split), page.slice(split)]
      expect(await drain(streamHtmlToMarkdown(chunked(chunks)))).toBe('Body')
      expect(await drain(streamHtmlToText(chunked(chunks)))).toBe('Body')
      expect(await drain(streamHtmlToSafeHtml(chunked(chunks)))).toBe('<p>Body</p>')
    }
  })

  it('still feeds the frontmatter title', () => {
    expect(htmlToMarkdown(page, { plugins: [frontmatterPlugin()] })).toBe('---\ntitle: Page\n---\n\nBody')
  })
})
