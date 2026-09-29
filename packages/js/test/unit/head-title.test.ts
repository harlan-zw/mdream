import { describe, expect, it } from 'vitest'
import { htmlToMarkdown, streamHtmlToMarkdown } from '../../src/index'

async function streamConvert(chunks: string[]): Promise<string> {
  const stream = new ReadableStream<string>({
    start(controller) {
      for (const chunk of chunks)
        controller.enqueue(chunk)
      controller.close()
    },
  })
  let output = ''
  for await (const chunk of streamHtmlToMarkdown(stream))
    output += chunk
  return output
}

// `<title>` is document metadata that browsers never render. The frontmatter
// plugin reads it; without the plugin it leaves no text, as in the Rust engine.
describe('<title>', () => {
  const page = '<html><head><title>Page</title></head><body><p>Body</p></body></html>'

  it('is dropped without frontmatter', async () => {
    expect(htmlToMarkdown(page)).toBe('Body')
    expect(htmlToMarkdown(page, { format: 'text' })).toBe('Body')
    expect(htmlToMarkdown(page, { format: 'html' })).toBe('<p>Body</p>')
    expect(htmlToMarkdown('<p>a</p><title>T</title><p>b</p>')).toBe('a\n\nb')
    for (const split of [1, 5, 20])
      expect(await streamConvert([page.slice(0, split), page.slice(split)])).toBe('Body')
  })

  it('still feeds the frontmatter title', () => {
    expect(htmlToMarkdown(page, { plugins: { frontmatter: true } })).toBe('---\ntitle: Page\n---\n\nBody')
  })
})
