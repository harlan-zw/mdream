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
    [
      String.raw`<a href="x\" onclick=alert(1)">link</a>`,
      String.raw`[link](<x\\>)`,
    ],
    [
      String.raw`<a href="c:\path\" title=t>link</a>`,
      String.raw`[link](<c:\\path\\> "t")`,
    ],
    [
      `<p>ok</p><img alt=Bob's src=/i.png><p>after</p>`,
      `ok\n\n![Bob's](/i.png)\n\nafter`,
    ],
    [
      `<a href=/a/b/>link</a>`,
      `[link](/a/b/)`,
    ],
  ])('keeps malformed attribute recovery stable across every split for %s', async (html, expected) => {
    expect(htmlToMarkdown(html)).toBe(expected)
    await expectStreamingParity(html)
  })

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
    '<ul><li>text <hr>after</li></ul>',
    '<ul><li><blockquote>text<hr></blockquote>after</li></ul>',
    '<ol><li><span>parent<ul><li>child</li><li>child 2</li></ul></span></li></ol>',
  ])('keeps cmark block structure across every split for %s', async (html) => {
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
    '<a href="/edit" title="Edit"><img src="/edit.svg" alt="Edit"></a>',
    '<a href="/x" aria-label="Open"><img src="/i" alt="Alt"></a>',
    '<a href="/x" title="Title"><span><span><img src="/i" alt="Alt"></span></span></a>',
    '<a href="/x"><img src="/i" alt="A"> </a>Caption',
    '<div><a href="/x"><x-wrap><img src="/i" alt="A"></x-wrap></a> Caption</div>',
  ])('keeps linked-image content stable across every split for %s', async (html) => {
    await expectStreamingParity(html)
  })

  it.each(['html', 'text'] as const)('keeps linked-image %s output stable across every split', async (format) => {
    await expectStreamingParity(
      '<a href="/x" title="Title"><img src="/i" alt="Alt"></a>',
      { format },
    )
  })

  it('keeps deferred linked-image whitespace across every split', async () => {
    const html = '<div><a href="/x"><span><img src="/i" alt="Alt"> </span></a>Caption</div>'
    expect(htmlToMarkdown(html, { format: 'text' })).toBe('Alt Caption')
    await expectStreamingParity(html, { format: 'text' })

    const imageSibling = '<div><a href="/x"><span><img src="/i" alt="Alt"> </span></a><img src="/caption" alt="Caption"></div>'
    expect(htmlToMarkdown(imageSibling)).toBe('[![Alt](/i)](/x) ![Caption](/caption)')
    expect(htmlToMarkdown(imageSibling, { format: 'text' })).toBe('Alt Caption')
    await expectStreamingParity(imageSibling)
    await expectStreamingParity(imageSibling, { format: 'text' })
  })

  it('keeps block-overridden image scopes across every split', async () => {
    const html = '<div><a href="/x"><img src="/i" alt="Alt"></a> Caption</div>'
    const plugins = {
      tagOverrides: {
        img: { spacing: [0, 0] as [number, number], isInline: false },
      },
    }
    expect(htmlToMarkdown(html, { plugins })).toBe('[![Alt](/i)](/x) Caption')
    expect(htmlToMarkdown(html, { plugins, format: 'text' })).toBe('Alt Caption')
    await expectStreamingParity(html, { plugins })
    await expectStreamingParity(html, { plugins, format: 'text' })

    const wrapperHtml = '<div><a href="/x"><x-block><img src="/i" alt="Alt"></x-block></a> <span>after</span></div>'
    const wrapperPlugins = {
      tagOverrides: {
        'x-block': { enter: '', exit: '', spacing: [0, 0] as [number, number], isInline: false },
      },
    }
    expect(htmlToMarkdown(wrapperHtml, { plugins: wrapperPlugins })).toBe('[![Alt](/i)](/x) after')
    await expectStreamingParity(wrapperHtml, { plugins: wrapperPlugins })
  })

  it('keeps whitespace-only text fallback stable across every split', async () => {
    await expectStreamingParity(
      '<a href="/x" title="Title"><img src="/i" alt=" "></a>',
      { format: 'text' },
    )
  })

  it.each([
    '<dl><dt>MPN:</dt><dd>D100</dd><dt>Availability:</dt><dd>Ships</dd></dl>',
    '<details><summary>Title</summary><p>Body</p></details>',
    '<address><p>One</p><p>Two</p></address>',
    '<details><p>a</p>\n\n<p>b</p></details><dl><dd>~tilde~</dd></dl>',
    '<details><p>a</p>\n\n<p>b</p></details><dl>a<span>b</span>~tilde~</dl>',
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
