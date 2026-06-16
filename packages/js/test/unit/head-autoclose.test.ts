import { describe, expect, it } from 'vitest'
import { htmlToMarkdown, streamHtmlToMarkdown } from '../../src/index'

async function streamConvert(chunks: string[]): Promise<string> {
  const stream = new ReadableStream<string>({
    start(controller) {
      for (const c of chunks)
        controller.enqueue(c)
      controller.close()
    },
  })
  let out = ''
  for await (const chunk of streamHtmlToMarkdown(stream))
    out += chunk
  return out
}

// Browser recovery: a page that never closes <head> (no </head>/<body>) parses
// its body content inside <head>, which collapses all block spacing to a single
// line. The parser auto-closes head on the first non-head start tag, matching the
// HTML "in head" insertion mode. Regression for marketingexamples.com pages.
describe('unclosed <head> auto-close', () => {
  it('produces the same output as the well-formed equivalent', () => {
    const broken = '<html><head><title>t</title><meta charset="utf-8"><div><h1>Title</h1><p>para one</p><h2>Heading</h2><p>para two</p></div></html>'
    const wellFormed = '<html><head><title>t</title><meta charset="utf-8"></head><body><div><h1>Title</h1><p>para one</p><h2>Heading</h2><p>para two</p></div></body></html>'
    expect(htmlToMarkdown(broken)).toBe(htmlToMarkdown(wellFormed))
    expect(htmlToMarkdown(broken)).toContain('# Title\n\npara one\n\n## Heading\n\npara two')
  })

  it('keeps head metadata in head until flow content appears', () => {
    const html = '<head><title>t</title><link rel="x"><style>a{}</style><p>body text</p>'
    expect(htmlToMarkdown(html)).toBe('t\n\nbody text')
  })

  it('does not keep body in head context for duplicated <head>', () => {
    // A second <head> closes the first, so the trailing <p> is body flow.
    const html = '<head><head><title>t</title><p>body text</p>'
    expect(htmlToMarkdown(html)).toBe('t\n\nbody text')
  })

  it('keeps <head> open across a chunk boundary that splits the triggering tag', async () => {
    // The auto-close must run only after the start tag is confirmed complete.
    // Splitting inside the <div ...> tag must not prematurely close head; the
    // streamed result must match the whole-document conversion.
    const whole = '<head><title>t</title><div class="x"><h1>Title</h1><p>body text</p></div>'
    const streamedSplit = await streamConvert(['<head><title>t</title><div', ' class="x"><h1>Title</h1><p>body text</p></div>'])
    const streamedWhole = await streamConvert([whole])
    // Splitting the triggering <div> tag across chunks must not change the result.
    expect(streamedSplit).toBe(streamedWhole)
    // And the result is correct: head closed, block spacing preserved.
    expect(streamedSplit.trim()).toBe(htmlToMarkdown(whole))
    expect(streamedSplit).toContain('# Title\n\nbody text')
  })
})
