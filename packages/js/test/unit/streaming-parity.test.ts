import type { ElementNode, MdreamOptions } from '../../src/types'
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

async function streamConvertAtSplit(html: string, split: number, options: Partial<MdreamOptions> = {}): Promise<string> {
  const stream = new ReadableStream<string>({
    start(controller) {
      if (split > 0)
        controller.enqueue(html.slice(0, split))
      if (split < html.length)
        controller.enqueue(html.slice(split))
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

  for (let chunkSize = 1; chunkSize < html.length; chunkSize++) {
    expect(await streamConvert(html, chunkSize, options), `chunk size ${chunkSize}`)
      .toBe(wholeStream)
  }
}

async function expectEverySplitParity(html: string, options: Partial<MdreamOptions> = {}): Promise<void> {
  const wholeStream = await streamConvert(html, html.length || 1, options)
  for (let split = 1; split < html.length; split++) {
    expect(await streamConvertAtSplit(html, split, options), `split ${split}`)
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

  it.each([
    [
      '<figure><img src="/i.png" alt="Alt"><figcaption>Caption</figcaption></figure>',
      '![Alt](/i.png)\n\n*Caption*',
    ],
    ['<figcaption></figcaption>', ''],
    ['<figcaption><div></div></figcaption>', ''],
    ['Before <figcaption><strong></strong></figcaption>After', 'Before After'],
    ['a<figcaption><br></figcaption>b', 'a  \nb'],
    ['<figcaption><br>x</figcaption>', '*x*'],
    ['<pre><figcaption>text</figcaption></pre>', '```\ntext\n```'],
    ['<pre><figcaption> \n </figcaption></pre>', ''],
    ['<blockquote><figcaption><br>x</figcaption></blockquote>', '>   \n> *x*'],
    ['Before<figcaption></figcaption>After', 'BeforeAfter'],
    ['Before<figcaption></figcaption> After', 'Before After'],
    ['Before <figcaption></figcaption>After', 'Before After'],
    ['<p>Before</p><figcaption></figcaption>After', 'Before\n\nAfter'],
    [
      '<ul><li><figure><img src="/i" alt="A"><figcaption>Caption</figcaption></figure></li></ul>',
      '- ![A](/i)\n\n  *Caption*',
    ],
    [
      '<ul><li>Before<figure><figcaption></figcaption></figure>After</li></ul>',
      '- Before After',
    ],
    [
      '<ul><li><figcaption>One</figcaption></li><li>Two</li></ul>',
      '- *One*\n\n- Two',
    ],
    [
      '<ul><li><figcaption>One</figcaption></li></ul><p>After</p>',
      '- *One*\n\nAfter',
    ],
    [
      '<ul><li><figcaption>One</figcaption><blockquote>Quote</blockquote></li></ul>',
      '- *One*\n\n  > Quote',
    ],
    [
      '<ul><li><figcaption>Outer</figcaption><ul><li>Inner</li></ul></li></ul>',
      '- *Outer*\n\n  - Inner',
    ],
    [
      '<ul><li>Before<figcaption> Caption </figcaption>After</li></ul>',
      '- Before\n\n  *Caption*\n\n  After',
    ],
    [
      '<ul><li>Before <figcaption> Caption </figcaption> After</li></ul>',
      '- Before\n\n  *Caption*\n\n  After',
    ],
    [
      '<ul><li><figcaption>x</figcaption><span> After</span></li></ul>',
      '- *x*\n\n  After',
    ],
    ['<figcaption><span> Caption</span></figcaption>', '*Caption*'],
    ['<figcaption><em>x</em></figcaption>', '**x**'],
    ['<figcaption><code>x</code></figcaption>', '*`x`*'],
    ['<figcaption><em></em></figcaption>', ''],
    ['<figcaption><code></code></figcaption>', ''],
    ['a<br><figcaption>b</figcaption>', 'a  \n\n*b*'],
    ['Before<figcaption><em></em><br>x</figcaption>', 'Before  \n*x*'],
    ['<figcaption><a href="/x"></a> x</figcaption>', '*[](/x)x*'],
    ['<figcaption><a href="/x">a</a> x</figcaption>', '*[a](/x) x*'],
    ['<pre><figcaption><code>x</code></figcaption></pre>', '```\nx\n```'],
    ['Before<figcaption><em><div></div></em></figcaption>After', 'BeforeAfter'],
    ['Before<figcaption><em></em><br></figcaption>After', 'Before  \nAfter'],
    [
      '<ul><li><figure>Before<figcaption><br><blockquote>x</blockquote></figcaption>After</figure></li></ul>',
      '- Before  \n  \n  > *x*\n\n  After',
    ],
    ['<figcaption><div> Caption</div></figcaption>', '*Caption*'],
    ['<em><figcaption><div>x</div></figcaption></em>', '**x**'],
    ['<figcaption>One*<span> Two</span></figcaption>', String.raw`*One\* Two*`],
    [
      '<blockquote>Before <figcaption> Caption </figcaption> After</blockquote>',
      '> Before\n>\n> *Caption*\n>\n> After',
    ],
    [
      '<ul><li><a href="/x"><figure><img src="/i" alt="A"><figcaption>Caption</figcaption></figure></a></li></ul>',
      '- [![A](/i)*Caption*](/x)',
    ],
  ])('keeps figcaption spacing stable across every split for %s', async (html, expected) => {
    expect(htmlToMarkdown(html)).toBe(expected)
    await expectStreamingParity(html)
    await expectEverySplitParity(html)
  })

  it.each([
    ['Before<figcaption></figcaption>After', 'BeforeAfter'],
    ['Before <figcaption> \n </figcaption>After', 'Before After'],
    ['Before<figcaption>One</figcaption><figcaption></figcaption>After', 'Before\n\nOne\n\nAfter'],
    ['<ul><li><figure><img alt=A><figcaption>Caption</figcaption></figure></li></ul>', 'A\n\nCaption'],
    ['<ul><li><figcaption>Caption</figcaption><img alt=A></li></ul>', 'Caption\n\nA'],
    ['<ul><li>Before<figcaption> Caption </figcaption>After</li></ul>', 'Before\n\nCaption\n\nAfter'],
    ['<blockquote>Before<span><figcaption><span> Caption</span></figcaption></span>After</blockquote>', 'Before\n\nCaption\n\nAfter'],
    ['Before<figcaption><br><br><br></figcaption>After', 'Before\n\nAfter'],
    ['A<figcaption><br>x</figcaption>', 'A\nx'],
  ])('keeps plain-text figcaption boundaries stable across every split for %s', async (html, expected) => {
    const options = { format: 'text' as const }
    expect(htmlToMarkdown(html, options)).toBe(expected)
    await expectStreamingParity(html, options)
    await expectEverySplitParity(html, options)
  })

  it('opens a caption for child exit-only hook output', async () => {
    const html = '<figcaption><span></span></figcaption>'
    const options = {
      hooks: [{
        onNodeExit(node: ElementNode) {
          return node.name === 'span' ? 'TAIL' : undefined
        },
      }],
    }
    expect(htmlToMarkdown(html, options)).toBe('*TAIL*')
    await expectEverySplitParity(html, options)
  })

  it('honors a zero-spacing figcaption override', async () => {
    const html = 'Before <figcaption> Caption </figcaption> After'
    const options = {
      plugins: {
        tagOverrides: {
          figcaption: { spacing: [0, 0] as [number, number] },
        },
      },
    }
    expect(htmlToMarkdown(html, options)).toBe('Before *Caption* After')
    await expectEverySplitParity(html, options)
  })

  it('opens a plain-text caption through a formatting wrapper', async () => {
    const html = '<figure><img alt=A><figcaption><strong> Caption </strong></figcaption></figure>'
    const options = { format: 'text' as const }
    expect(htmlToMarkdown(html, options)).toBe('A\n\nCaption')
    await expectEverySplitParity(html, options)
  })

  it.each([
    '<em><figcaption>Caption</figcaption></em>',
    '<a href="/x"><figcaption>Caption</figcaption></a>',
    '<strong><span><figcaption>Caption</figcaption></span></strong>',
  ])('keeps plain-text caption spacing through formatting ancestors for %s', async (html) => {
    const options = { format: 'text' as const }
    expect(htmlToMarkdown(`Before${html}After`, options)).toBe('Before\n\nCaption\n\nAfter')
    await expectEverySplitParity(`Before${html}After`, options)
  })

  it('suppresses plain-text caption spacing in table cells', async () => {
    const html = '<table><tr><td>Before<strong><figcaption>Caption</figcaption></strong>After</td></tr></table>'
    const options = { format: 'text' as const }
    expect(htmlToMarkdown(html, options)).toBe('BeforeCaptionAfter')
    await expectEverySplitParity(html, options)
  })

  it.each([
    '<a href="/x">Before<figcaption>Caption</figcaption>After</a>',
    '<em>Before<figcaption>Caption</figcaption>After</em>',
    '<table><tr><td>Before<figcaption>Caption</figcaption>After</td></tr></table>',
  ])('suppresses explicit caption spacing in structural inline contexts for %s', async (html) => {
    const options = {
      plugins: {
        tagOverrides: {
          figcaption: { spacing: [3, 3] as [number, number] },
        },
      },
    }
    const defaultOutput = htmlToMarkdown(html)
    expect(htmlToMarkdown(html, options)).toBe(defaultOutput)
    await expectEverySplitParity(html, options)
  })

  it('honors explicit caption spacing through a transparent span', async () => {
    const html = '<span>Before<figcaption>Caption</figcaption>After</span>'
    const options = {
      plugins: {
        tagOverrides: {
          figcaption: { spacing: [3, 3] as [number, number] },
        },
      },
    }
    expect(htmlToMarkdown(html, options)).toBe('Before\n\n\n*Caption*\n\n\nAfter')
    await expectEverySplitParity(html, options)
  })

  it.each(['onNodeEnter', 'onNodeExit'] as const)('flushes a pending pre fence before figcaption %s output', async (hook) => {
    const html = '<pre><figcaption></figcaption></pre>'
    const options = {
      hooks: [{
        [hook](node: ElementNode) {
          return node.name === 'figcaption' ? 'HOOK' : undefined
        },
      }],
    }
    expect(htmlToMarkdown(html, options)).toBe('```\nHOOK\n```')
    await expectEverySplitParity(html, options)
  })

  it('preserves literal figcaption overrides inside pre', async () => {
    const html = '<pre><figcaption></figcaption>x</pre>'
    const options = {
      plugins: { tagOverrides: { figcaption: { enter: '^' } } },
    }
    expect(htmlToMarkdown(html, options)).toBe('```\n^x\n```')
    await expectEverySplitParity(html, options)
  })

  it('preserves literal code overrides inside pre', async () => {
    for (const [html, options, expected] of [
      [
        '<pre><code>x</code></pre>',
        { plugins: { tagOverrides: { code: { enter: '^' } } } },
        '```\n^x\n```',
      ],
      [
        '<pre><code class="language-js">x</code></pre>',
        { plugins: { tagOverrides: { code: { enter: '^', exit: '$' } } } },
        '```js\n^x$\n```',
      ],
    ] as const) {
      expect(htmlToMarkdown(html, options)).toBe(expected)
      await expectEverySplitParity(html, options)
    }
  })

  it('retracts an empty cleaned link before caption block content', async () => {
    const html = '<figcaption><a href="/x"></a><blockquote>x</blockquote></figcaption>'
    const options = { clean: { emptyLinkText: true } }
    expect(htmlToMarkdown(html, options)).toBe('> *x*')
    await expectEverySplitParity(html, options)
  })

  it('does not insert inline spacing after an anchored caption opener', async () => {
    const html = '<figure><img src="i" alt="A"><figcaption><a href="x">Source</a></figcaption></figure>'
    expect(htmlToMarkdown(html)).toBe('![A](i)\n\n*[Source](x)*')
    await expectEverySplitParity(html)
  })

  it('collapses an autolink after an anchored caption opener', async () => {
    const html = '<figcaption><a href="https://x.com">https://x.com</a></figcaption>'
    expect(htmlToMarkdown(html)).toBe('*<https://x.com>*')
    await expectEverySplitParity(html)
  })

  it('does not reopen a committed caption after a streamed empty marker', async () => {
    const first = 'Before<figcaption><a href="x">x</a>'
    const html = `${first}<em></em>y</figcaption>After`
    const expected = 'Before\n\n*[x](x)y*\n\nAfter'
    expect(htmlToMarkdown(html)).toBe(expected)
    expect(await streamConvertAtSplit(html, first.length)).toBe(expected)
    await expectEverySplitParity(html)
  })

  it('rolls back deferred breaks inside a cleaned empty link', async () => {
    const html = '<figure><img src="i" alt="A"><figcaption><a href="x"><br></a>Caption</figcaption></figure>'
    const options = { clean: { emptyLinkText: true } }
    expect(htmlToMarkdown(html, options)).toBe('![A](i)\n\n*Caption*')
    await expectEverySplitParity(html, options)
  })

  it('retracts clean-dropped caption children', async () => {
    const emptyImage = 'A<figcaption><img src="i"></figcaption>B'
    const emptyImageOptions = { clean: { emptyImages: true } }
    expect(htmlToMarkdown(emptyImage, emptyImageOptions)).toBe('AB')
    await expectEverySplitParity(emptyImage, emptyImageOptions)
    const whitespaceImage = 'A<figcaption><img src="i" alt=" "></figcaption>B'
    expect(htmlToMarkdown(whitespaceImage, emptyImageOptions)).toBe('AB')
    await expectEverySplitParity(whitespaceImage, emptyImageOptions)

    const emptyLink = '<figcaption><em><a href="x"><br></a></em></figcaption>'
    const emptyLinkOptions = { clean: { emptyLinkText: true } }
    expect(htmlToMarkdown(emptyLink, emptyLinkOptions)).toBe('')
    await expectEverySplitParity(emptyLink, emptyLinkOptions)
    const followedEmptyLink = '<figcaption><em><a href="x"></a></em>x</figcaption>'
    expect(htmlToMarkdown(followedEmptyLink, emptyLinkOptions)).toBe('*x*')
    await expectEverySplitParity(followedEmptyLink, emptyLinkOptions)
  })

  it('keeps a deferred caption break inside its link', async () => {
    const html = '<figcaption><a href="x"><br></a>x</figcaption>'
    expect(htmlToMarkdown(html)).toBe('*[  \n](x)x*')
    await expectEverySplitParity(html)
  })

  it('normalizes spaces around deferred caption breaks', async () => {
    for (const [html, expected] of [
      ['a <figcaption><br>x</figcaption>', 'a  \n*x*'],
      ['a<figcaption><br></figcaption> b', 'a  \nb'],
    ] as const) {
      expect(htmlToMarkdown(html)).toBe(expected)
      await expectEverySplitParity(html)
    }
  })

  it('defers pre fences through captions and suppressed wrappers', async () => {
    for (const [html, expected] of [
      ['<figcaption><pre>x</pre></figcaption>', '*```\nx\n```*'],
      ['<pre><figcaption><em></em></figcaption></pre>', ''],
    ] as const) {
      expect(htmlToMarkdown(html)).toBe(expected)
      await expectEverySplitParity(html)
    }
  })

  it('holds empty list spacing behind a tentative caption marker', async () => {
    const html = '<img alt="x"><menu><li><figcaption><em></em></figcaption></li></menu>'
    expect(htmlToMarkdown(html)).toBe('![x]()\n\n-')
    await expectEverySplitParity(html)
  })

  it('holds deferred caption breaks until later visible content commits the opener', async () => {
    let controller!: ReadableStreamDefaultController<string>
    const stream = new ReadableStream<string>({
      start(value) {
        controller = value
      },
    })
    const iterator = streamHtmlToMarkdown(stream)[Symbol.asyncIterator]()
    controller.enqueue('Before<figcaption><br><br>')
    const first = await iterator.next()
    expect(first).toEqual({ value: 'Before', done: false })

    controller.enqueue('x</figcaption>After')
    controller.close()
    let output = first.value || ''
    for (;;) {
      const result = await iterator.next()
      if (result.done)
        break
      output += result.value
    }
    expect(output).toBe(htmlToMarkdown('Before<figcaption><br><br>x</figcaption>After'))
  })

  it('holds an anchored caption opener until a block child commits it', async () => {
    const html = 'Before<figcaption><em><div>x</div></em></figcaption>After'
    expect(htmlToMarkdown(html)).toBe('Before\n\n**x**\n\nAfter')
    await expectStreamingParity(html)
    await expectEverySplitParity(html)
  })

  it('does not mistake emphasis before an empty block for a caption suffix', async () => {
    const html = '<ul><li><em>x</em><p></p><blockquote>q</blockquote></li></ul>'
    expect(htmlToMarkdown(html)).toBe('- *x*\n\n  \n  > q')
    await expectEverySplitParity(html)
  })

  it('does not treat hook output as an empty figcaption marker', async () => {
    const html = 'Before<figcaption></figcaption>After'
    const options = {
      hooks: [{
        onNodeEnter(node: ElementNode) {
          return node.name === 'figcaption' ? 'HOOK' : undefined
        },
      }],
    }
    expect(htmlToMarkdown(html, options)).toBe('Before\n\nHOOK*\n\nAfter')
    await expectEverySplitParity(html, options)
  })

  it('places wrapper exit output after the caption boundary', async () => {
    const html = '<ul><li><figure><figcaption>x</figcaption></figure>After</li></ul>'
    const options = {
      hooks: [{
        onNodeExit(node: ElementNode) {
          return node.name === 'figure' ? 'TAIL' : undefined
        },
      }],
    }
    expect(htmlToMarkdown(html, options)).toBe('- *x*\n\n  TAIL After')
    await expectEverySplitParity(html, options)
  })

  it('keeps the default opener with an exit-only caption override', async () => {
    const html = '<figcaption>x</figcaption>'
    const options = {
      plugins: {
        tagOverrides: {
          figcaption: { exit: ')' },
        },
      },
    }
    expect(htmlToMarkdown(html, options)).toBe('*x)')
    await expectEverySplitParity(html, options)
  })

  it('keeps blockquote exit output after a caption boundary', async () => {
    const html = '<blockquote><figcaption>x</figcaption></blockquote>'
    const options = {
      plugins: {
        tagOverrides: {
          blockquote: { exit: 'TAIL' },
        },
      },
    }
    expect(htmlToMarkdown(html, options)).toBe('*x*\n\nTAIL')
    await expectEverySplitParity(html, options)
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
