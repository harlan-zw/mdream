import { describe, expect, it, vi } from 'vitest'
import { htmlToSafeHtml, streamHtmlToSafeHtml } from '../../src/html'
import { createPlugin, htmlToMarkdown, streamHtmlToMarkdown } from '../../src/index'
import { extractionPlugin } from '../../src/plugins/extraction'
import { frontmatterPlugin } from '../../src/plugins/frontmatter'
import { htmlToText, streamHtmlToText } from '../../src/text'

describe('stream callbacks', () => {
  it.each([
    ['markdown', htmlToMarkdown, streamHtmlToMarkdown],
    ['text', htmlToText, streamHtmlToText],
    ['html', htmlToSafeHtml, streamHtmlToSafeHtml],
  ] as const)('provides each node depth to %s callbacks', async (_name, convert, streamConvert) => {
    const depths: (number | undefined)[] = []
    const entered: (number | undefined)[] = []
    const plugins = [createPlugin({
      onNodeEnter(_node, state) {
        entered.push(state.depth)
      },
      onDocumentEnd(state) {
        depths.push(state.depth)
      },
    })]
    const html = '<main><p>Text</p></main>'
    const expected = convert(html, { plugins })
    const stream = new ReadableStream<string>({
      start(controller) {
        controller.enqueue(html)
        controller.close()
      },
    })
    let output = ''
    for await (const chunk of streamConvert(stream, { plugins }))
      output += chunk
    expect(output).toBe(expected)
    expect(entered).toEqual([1, 2, 1, 2])
    expect(depths).toEqual([1, 1])
  })
  it('calls the frontmatter callback and extraction handlers like one-shot', async () => {
    const html = '<html><head><title>Page</title></head><body><p><a href="/a">A</a></p></body></html>'
    const frontmatter = vi.fn()
    const link = vi.fn()
    const stream = new ReadableStream<string>({
      start(controller) {
        controller.enqueue(html.slice(0, 30))
        controller.enqueue(html.slice(30))
        controller.close()
      },
    })
    let output = ''
    const plugins = [frontmatterPlugin({ onExtract: frontmatter }), extractionPlugin({ 'a[href]': link })]
    for await (const chunk of streamHtmlToMarkdown(stream, { plugins }))
      output += chunk
    expect(output).toBe(htmlToMarkdown(html, { plugins: [frontmatterPlugin()] }))
    expect(frontmatter).toHaveBeenCalledWith({ title: 'Page' })
    expect(link).toHaveBeenCalledOnce()
  })
})
