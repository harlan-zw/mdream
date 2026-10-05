import { describe, expect, it } from 'vitest'
import { htmlToSafeHtml, streamHtmlToSafeHtml } from '../../src/html'
import { htmlToMarkdown, streamHtmlToMarkdown } from '../../src/index'
import { createPlugin } from '../../src/pluggable/plugin'
import { filterPlugin } from '../../src/plugins/filter'
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

describe('safe HTML leading output', () => {
  it('keeps spaces after a plugin emits and streams the first output', async () => {
    const options = {
      plugins: [createPlugin({
        onNodeEnter(node, state) {
          if (node.name === 'x-output')
            state.buffer.push('prefix')
        },
      })],
    }
    const html = '<x-output></x-output> abc'
    expect(htmlToSafeHtml(html, options)).toBe('prefix abc')
    expect(await drain(streamHtmlToSafeHtml(chunked([...html]), options))).toBe('prefix abc')
  })
  it.each([
    ['<script></script>\n<p>abc</p>', '<p>abc</p>'],
    ['<script></script>\nabc', 'abc'],
    ['<script></script>\n', ''],
    ['<script></script>\n<pre> abc</pre>', '<pre tabindex="0"><code> abc</code></pre>'],
    ['<script></script>\n<h2> abc</h2>', '<h2 id="abc">abc</h2>'],
    ['<script></script>&nbsp;abc', '\u00A0abc'],
    ['<script></script>\u000Babc', '\u000Babc'],
    ['<script></script>\u2003abc', '\u2003abc'],
    ['<span></span> abc', '<span></span> abc'],
    ['<br> abc', '<br> abc'],
  ])('keeps whitespace relative to the first rendered output: %s', async (html, expected) => {
    for (const filtered of [false, true]) {
      const source = filtered ? `<nav>hidden</nav>${html}` : html
      const options = filtered ? { plugins: [filterPlugin({ exclude: ['nav'] })] } : {}
      expect(htmlToSafeHtml(source, options)).toBe(expected)
      for (let width = 1; width <= source.length; width++) {
        const parts: string[] = []
        for (let offset = 0; offset < source.length; offset += width)
          parts.push(source.slice(offset, offset + width))
        expect(await drain(streamHtmlToSafeHtml(chunked(parts), options)), `chunk width ${width}`).toBe(expected)
      }
    }
  })
})
