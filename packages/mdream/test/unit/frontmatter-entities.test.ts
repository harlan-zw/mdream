import { htmlToMarkdown as jsHtmlToMarkdown } from '@mdream/js'
import { frontmatterPlugin } from '@mdream/js/plugins'
import { htmlToMarkdown, streamHtmlToMarkdown } from 'mdream'
import { expect, it } from 'vitest'

it.each([
  ['A &amp; B', 'A & B'],
  ['&#65; &#x1f984; &copy;', 'A 🦄 ©'],
  ['&amp;copy; &amp;#65;', '&copy; &#65;'],
])('decodes title metadata once: %s', async (encoded, decoded) => {
  const html = `<head><title>${encoded}</title></head><p>Body</p>`
  let nativeTitle: string | undefined
  let jsTitle: string | undefined
  const markdown = htmlToMarkdown(html, { frontmatter: value => nativeTitle = value.title })
  const js = jsHtmlToMarkdown(html, {
    plugins: [frontmatterPlugin({ onExtract: value => jsTitle = value.title })],
  })
  expect(nativeTitle).toBe(decoded)
  expect(jsTitle).toBe(decoded)
  expect(markdown).toBe(js)
  let streamTitle: string | undefined
  const input = new ReadableStream<string>({
    start(controller) {
      for (const char of html)
        controller.enqueue(char)
      controller.close()
    },
  })
  let streamed = ''
  for await (const chunk of streamHtmlToMarkdown(input, { frontmatter: value => streamTitle = value.title }))
    streamed += chunk
  expect(streamTitle).toBe(decoded)
  expect(streamed).toBe(markdown)
})
