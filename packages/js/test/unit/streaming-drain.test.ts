import type { ParseState } from '../../src/parse'
import { describe, expect, it } from 'vitest'
import { htmlToMarkdown, streamHtmlToMarkdown } from '../../src/index'
import { createMarkdownProcessor } from '../../src/markdown-processor'
import { finalizeParse, parseHtmlStream } from '../../src/parse'

function chunkedStream(html: string, chunkSize: number): ReadableStream<string> {
  return new ReadableStream({
    start(controller) {
      for (let offset = 0; offset < html.length; offset += chunkSize)
        controller.enqueue(html.slice(offset, offset + chunkSize))
      controller.close()
    },
  })
}

async function streamConvert(html: string, chunkSize: number): Promise<string> {
  let markdown = ''
  for await (const chunk of streamHtmlToMarkdown(chunkedStream(html, chunkSize)))
    markdown += chunk
  return markdown
}

function hashChunk(hash: number, chunk: string): number {
  for (let i = 0; i < chunk.length; i++)
    hash = Math.imul(hash ^ chunk.charCodeAt(i), 16777619)
  return hash >>> 0
}

const BLOCK_NEWLINE_HTML = [
  '<div class="wrap">\n\t\t\t\t        ',
  '<form action="https://ex.example/act?x=1&amp;id=42" class="foo bar wrap" data-flag method="post">',
  '<a aria-controls="dd"\n aria-expanded="false"\n class="btn menu-btn"\n data-dropdown="dd"\n href="#">\n ',
  '<span>Alpha Beta Gamma</a>\n<li>\n </li>\n</form>',
  '<div class="badges"><a href="/other-link/" target="_blank" class="bp"> Delta</a></div></div>',
].join('')

describe('streaming drain parity', () => {
  it.each([
    '<div>Alpha</div>',
    '<div>Alpha</div><div>Beta</div>',
    '<div>Alpha</div><em></em>',
    '<div>Alpha</div><em></em><div>Beta</div>',
    '<div>Alpha</div><em></em> tail',
    '<p>before <strong></strong><em>after</em></p>',
    '<blockquote><p>quote</p></blockquote><p>after</p>',
    '<ul><li>alpha</li><li>beta</li></ul>',
    '<ul><li><a href="/t">Schedule</a> New<br> <div>Domain Services</div></li></ul>',
    '<p>before<br></p>',
    '<details><summary>Title</summary><p>Body</p></details>',
    '<pre><code>alpha\n\n</code></pre>',
    '<pre><code>const x = `hi $' + '{y}`;</code></pre>',
    '<p>use <code>a`b</code> here</p>',
    '<table><tr><td>a`b</td><td>c\\d</td></tr></table>',
    '<p>text with <a href="/x">a [bracket] link</a> end</p>',
    '<ol><li>one<pre><code>cmd</code></pre></li><li>two</li></ol>',
    '<ul><li>one<pre><code>cmd</code></pre></li><li>two</li></ul>',
    '<summary>text <svg></svg></summary>',
    '<details><summary>text <svg><polyline points="1 2"></polyline></svg></summary><p>b</p></details>',
    '<h3>Set priority</h3><a class="anchor-link" href="#x"></a><p>The value.</p>',
    '<h2>Section</h2><a href="/x"><svg></svg></a><p>Body text.</p>',
    '<a href="https://example.com">https://example.com</a>',
    '<dl><dt>MPN:</dt><dd>D100</dd><dt>Availability:</dt><dd>Ships</dd></dl>',
    '<address><p>One</p><p>Two</p></address>',
    '<p>before</p><script>var x = 1; if (a < b) { y(); }</script><p>after</p>',
    '<script>a()</script><script>b()</script><p>ok</p>',
    '<p>x</p><script>let s = "</scr" + "ipt>end";</script><p>y</p>',
    '<p>one</p><script>\n  line1\n  line2\n</script><p>two</p>',
    '<p>answered on <span>03 Apr 2013,&nbsp;</span><span>09:53 AM</span></p>',
  ])('matches one-shot bytes at every chunk width: %s', async (html) => {
    const expected = htmlToMarkdown(html)

    for (let chunkSize = 1; chunkSize <= html.length; chunkSize++) {
      expect(await streamConvert(html, chunkSize), `chunkSize=${chunkSize}`).toBe(expected)
    }
  })

  it('keeps block newline context across drained chunks', async () => {
    const expected = htmlToMarkdown(BLOCK_NEWLINE_HTML)

    for (const chunkSize of [1, 3, 7, 16, 40])
      expect(await streamConvert(BLOCK_NEWLINE_HTML, chunkSize), `chunkSize=${chunkSize}`).toBe(expected)
  })

  it('bounds retained output while streaming a raw HTML anchor body', () => {
    const processor = createMarkdownProcessor()
    const parseState: ParseState = {
      depthMap: processor.state.depthMap,
      depth: 0,
      resolvedPlugins: [],
      plainText: false,
    }
    const text = '0123456789abcdef'
    const repetitions = 32 * 1024
    const html = `<details><a href="/x">${`<span>${text}</span>`.repeat(repetitions)}</a></details>`
    const expectedLength = '<details><a href="/x">'.length + text.length * repetitions + '</a></details>'.length
    const chunkSize = 4 * 1024
    let remainingHtml = ''
    let emittedLength = 0
    let emittedHash = 2166136261
    let peakRetainedLength = 0

    for (let offset = 0; offset < html.length; offset += chunkSize) {
      remainingHtml = parseHtmlStream(remainingHtml + html.slice(offset, offset + chunkSize), parseState, processor.processEvent)
      const chunk = processor.getMarkdownChunk()
      emittedLength += chunk.length
      emittedHash = hashChunk(emittedHash, chunk)

      let retainedLength = 0
      for (let i = 0; i < processor.state.buffer.length; i++)
        retainedLength += processor.state.buffer[i]!.length
      if (retainedLength > peakRetainedLength)
        peakRetainedLength = retainedLength
    }

    finalizeParse(remainingHtml, parseState, processor.processEvent)
    const finalChunk = processor.getMarkdownChunk()
    emittedLength += finalChunk.length
    emittedHash = hashChunk(emittedHash, finalChunk)

    let expectedHash = hashChunk(2166136261, '<details><a href="/x">')
    for (let i = 0; i < repetitions; i++)
      expectedHash = hashChunk(expectedHash, text)
    expectedHash = hashChunk(expectedHash, '</a></details>')

    expect(emittedLength).toBe(expectedLength)
    expect(emittedHash).toBe(expectedHash)
    expect(peakRetainedLength).toBeLessThan(chunkSize)
  })
})
