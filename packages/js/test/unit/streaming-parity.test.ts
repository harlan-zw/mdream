import type { MdreamOptions } from '../../src/types'
import { describe, expect, it } from 'vitest'
import { htmlToMarkdown, streamHtmlToMarkdown } from '../../src/index'

async function streamConvert(html: string, chunkSize: number, options: Partial<MdreamOptions> = {}): Promise<string> {
  const stream = new ReadableStream<string>({
    start(controller) {
      for (let index = 0; index < html.length; index += chunkSize)
        controller.enqueue(html.slice(index, index + chunkSize))
      controller.close()
    },
  })
  let output = ''
  for await (const chunk of streamHtmlToMarkdown(stream, options))
    output += chunk
  return output
}

async function expectStreamingParity(html: string, options: Partial<MdreamOptions> = {}): Promise<void> {
  const expected = htmlToMarkdown(html, options)
  const wholeStream = await streamConvert(html, html.length || 1, options)
  expect(wholeStream.trimEnd(), 'whole stream differs from one shot').toBe(expected)

  for (let chunkSize = 1; chunkSize <= html.length; chunkSize++) {
    expect(await streamConvert(html, chunkSize, options), `chunk size ${chunkSize}`)
      .toBe(wholeStream)
  }
}

describe('streaming parity with the Rust core', () => {
  it.each([
    '<pre><code>const x = `hi $' + '{y}`;</code></pre>',
    '<p>use <code>a`b</code> here</p>',
    '<table><tr><td>a`b</td><td>c\\d</td></tr></table>',
    '<p>text with <a href="/x">a [bracket] link</a> end</p>',
  ])('does not reprocess escaped text for %s', async (html) => {
    await expectStreamingParity(html)
  })

  it.each([
    '<ol><li>one<pre><code>cmd</code></pre></li><li>two</li></ol>',
    '<ul><li>one<pre><code>cmd</code></pre></li><li>two</li></ul>',
    '<ol><li>one<pre><code>a</code></pre></li><li>two</li><li>three</li></ol>',
  ])('keeps list markers after fenced code for %s', async (html) => {
    await expectStreamingParity(html)
  })

  it.each([
    '<blockquote><p>intro</p><ul><li>one</li><li>two</li></ul></blockquote>',
    '<blockquote>lead<table><tr><td>a</td></tr></table>tail</blockquote>',
    '<blockquote><ul><li>one<ul><li>sub</li></ul></li></ul></blockquote>',
    '<ul><li><blockquote><ul><li>x</li><li>y</li></ul></blockquote></li></ul>',
  ])('keeps blockquote structure across every split for %s', async (html) => {
    await expectStreamingParity(html)
  })

  it.each([
    '<summary>text <svg></svg></summary>',
    '<details><summary>text <svg><polyline points="1 2"></polyline></svg></summary><p>b</p></details>',
  ])('keeps raw closing tags after foreign children for %s', async (html) => {
    await expectStreamingParity(html)
  })

  it.each([
    '<h3>Set priority</h3><a class="anchor-link" href="#x"></a><p>The value.</p>',
    '<h2>Section</h2><a href="/x"><svg></svg></a><p>Body text.</p>',
    '<p>First para.</p><em></em><p>Second para.</p>',
    '<ul><li><h3>NetSparkle</h3><a class="anchor-link" href="#x"><span><svg></svg></span></a></li></ul><p>Copyright.</p>',
  ])('keeps block spacing around empty inline elements for %s', async (html) => {
    await expectStreamingParity(html)
  })

  it('does not emit link syntax before an autolink rewrite is final', async () => {
    await expectStreamingParity('<a href="https://example.com">https://example.com</a>')
  })

  it.each([
    '<a href="">text</a>',
    '<a href="docs/a b">text</a>',
    String.raw`<a href="docs/(a)\file">text</a>`,
    String.raw`<a href="/x" title="say &quot;hi&quot; \ path">text</a>`,
    String.raw`<img src="/x.png" alt="a ] \ *bold* _em_ &#96;code&#96;">`,
    String.raw`<img src="/x.png" alt="alt" title="say &quot;hi&quot; \ path">`,
  ])('keeps serialized link and image output stable for %s', async (html) => {
    await expectStreamingParity(html)
  })

  it.each([
    '<dl><dt>MPN:</dt><dd>D100</dd><dt>Availability:</dt><dd>Ships</dd></dl>',
    '<details><summary>Title</summary><p>Body</p></details>',
    '<address><p>One</p><p>Two</p></address>',
  ])('keeps raw HTML block closes stable for %s', async (html) => {
    await expectStreamingParity(html)
  })

  it.each([
    '<p>before</p><script>var x = 1; if (a < b) { y(); }</script><p>after</p>',
    '<script>a()</script><script>b()</script><p>ok</p>',
    '<p>x</p><script>let s = "</scr" + "ipt>end";</script><p>y</p>',
    '<p>one</p><script>\n  line1\n  line2\n</script><p>two</p>',
  ])('drops script data without disturbing its neighbors for %s', async (html) => {
    await expectStreamingParity(html)
  })

  it('keeps a meaningful non breaking space before an inline sibling', async () => {
    await expectStreamingParity('<p>answered on <span>03 Apr 2013,&nbsp;</span><span>09:53 AM</span></p>')
  })
})
