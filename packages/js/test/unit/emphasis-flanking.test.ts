import { describe, expect, it } from 'vitest'
import { clean } from '../../src/clean'
import { htmlToMarkdown, streamHtmlToMarkdown } from '../../src/index'
import { htmlToText } from '../../src/text'

// CommonMark opens a delimiter run only when it is left-flanking and closes it
// only when it is right-flanking. An opener that cannot open turns its pair
// into raw HTML; a closer that cannot close is followed by a character
// reference, which starts with punctuation.
const cases: [string, string][] = [
  // Non-ASCII preceding characters are outside the lean opening rule.
  ['<p>é<strong>!b</strong></p>', 'é**!b**'],
  ['<p>a<strong><span><span><a href="/x">b</a></span></span></strong><span>c</span></p>', 'a<strong>[b](/x)</strong>c'],
  ['<p><strong><span><a href="/x">b</a></span></strong><span><span>c</span></span></p>', '**[b](/x)**&#99;'],
  ['<p><i>a</i><b><a href="/y">x</a></b></p>', '*a***[x](/y)**'],
  ['<p><b><a href="/x">a</a></b><i>c</i></p>', '**[a](/x)***&#99;*'],
  ['<p><b><i>a</i></b><b><a href="/y">x</a></b></p>', '***a*****[x](/y)**'],
  ['<p><b><a href="/x">a</a></b><b><i>c</i></b></p>', '**[a](/x)*****&#99;***'],
  ['<p>a<strong><a href="/x">b</a></strong></p>', 'a<strong>[b](/x)</strong>'],
  ['<p><strong><a href="/x">b</a></strong>c</p>', '**[b](/x)**&#99;'],
  ['<p>a<b><a href="/x">b</a></b>c</p>', 'a<strong>[b](/x)</strong>c'],
  ['<p>a<em><img src="/i.png" alt="i"></em>c</p>', 'a<em>![i](/i.png)</em>c'],
  ['<p>a<i><code>x</code></i>c</p>', 'a<em>`x`</em>c'],
  ['<p>a<strong><em><a href="/x">b</a></em></strong>c</p>', 'a***[b](/x)***&#99;'],
  ['<p>a<del><a href="/x">b</a></del>c</p>', 'a ~~[b](/x)~~&#99;'],
  ['<p><s><a href="/x">b</a></s>c</p>', '~~[b](/x)~~&#99;'],
  ['<p>a<strong>!b</strong></p>', 'a<strong>!b</strong>'],
  ['<p><strong>b!</strong>c</p>', '**b!**&#99;'],
  ['<p><strong><a href="/x">b</a></strong><span>c</span></p>', '**[b](/x)**&#99;'],
  ['<p>a<strong>b <a href="/x">c</a></strong>d</p>', 'a**b [c](/x)**&#100;'],
  // A no-break space counts as whitespace next to a delimiter run.
  ['<p>a&nbsp;<strong><a href="/x">b</a></strong>c</p>', 'a **[b](/x)**&#99;'],
  ['<table><tr><th>h</th></tr><tr><td>a<strong><a href="/x">b</a></strong>c</td></tr></table>', '| h |\n| --- |\n| a<strong>[b](/x)</strong>c |'],
  // Delimiters that flank stay as they are.
  ['<p>a <strong><a href="/x">b</a></strong> c</p>', 'a **[b](/x)** c'],
  ['<p>a<strong>b</strong>c</p>', 'a**b**c'],
  ['<p><a href="/y">a<strong>b!</strong></a>c</p>', '[a**b!**](/y)c'],
  // A strikethrough opener is not followed by a separator.
  ['<p><del><a href="/x">b</a></del></p>', '~~[b](/x)~~'],
  // A block inside a decided pair leaves its closer to be written as decided.
  ['<div>a<strong><a href="/x">b</a><div>c</div></strong>d</div><p>next</p>', 'a<strong>[b](/x) c</strong>d\n\nnext'],
  ['<div>x<em>!<p>c</p></em>d</div><p>next</p>', 'x<em>! c</em>d\n\nnext'],
  ['<ul><li>a<strong><code>b</code><ul><li>c</li></ul></strong>d</li></ul><p>next</p>', '- a<strong>`b`  - c</strong>d\n\nnext'],
  ['<div>a<strong>!b<hr></strong>d</div><p>next</p>', 'a<strong>!b ---</strong>d\n\nnext'],
  ['<div>a<strong>!b<figure><figcaption>c</figcaption></figure></strong>d</div><p>next</p>', 'a<strong>!b*c*</strong>d\n\nnext'],
  ['<div>a<strong>b<div>c!</div></strong>d</div><p>next</p>', 'a**b c!**&#100;\n\nnext'],
]

function toStream(chunks: string[]): ReadableStream<string> {
  return new ReadableStream<string>({
    start(controller) {
      for (const chunk of chunks)
        controller.enqueue(chunk)
      controller.close()
    },
  })
}

async function streamConvert(html: string, chunkSize: number): Promise<string> {
  const chunks: string[] = []
  for (let index = 0; index < html.length; index += chunkSize)
    chunks.push(html.slice(index, index + chunkSize))
  let output = ''
  for await (const chunk of streamHtmlToMarkdown(toStream(chunks)))
    output += chunk
  return output
}

describe('emphasis delimiters that cannot flank', () => {
  it.each([
    ['<h2><em>x</em><a href="#x"><strong>!b</strong></a></h2>', '## *x***!b**'],
    ['<h2>Q<a href="#q">#</a></h2>', '## Q \\#'],
    ['<h2>Q<a href="#q">##</a></h2>', '## Q \\##'],
    ['<h2><strong>b!</strong><a href="#x">c</a></h2>', '## **b!**c'],
    ['<h2><a href="#x">x</a><strong>!b</strong></h2>', '## x<strong>!b</strong>'],
    ['<h2>x<a href="#x"><strong>!b</strong></a></h2>', '## x **!b**'],
    ['<h2><a href="#x"><strong>b!</strong></a>c</h2>', '## **b!**&#99;'],
    ['<h2><a href="#x"><strong><em>b!</em></strong></a><span>c</span></h2>', '## ***b!***&#99;'],
    ['<h2><a href="/x"><strong>b!</strong></a>c</h2>', '## [**b!**](/x)c'],
  ])('keeps streaming parity after heading link cleanup in %s', async (html, expected) => {
    const options = { clean: clean({ selfLinkHeadings: true }) }
    expect(htmlToMarkdown(html, options)).toBe(expected)
    for (let width = 1; width <= html.length; width++) {
      const input = new ReadableStream<string>({
        start(controller) {
          for (let offset = 0; offset < html.length; offset += width)
            controller.enqueue(html.slice(offset, offset + width))
          controller.close()
        },
      })
      let output = ''
      for await (const chunk of streamHtmlToMarkdown(input, options))
        output += chunk
      expect(output, `width=${width}`).toBe(expected)
    }
  })

  it.each([
    ['<p><em>x</em><a href="#missing"><strong>!b</strong></a></p>', '*x***!b**'],
    ['<p><em>x</em><a href="#found"><strong>!b</strong></a></p><h2>found</h2>', '*x*[**!b**](#found)\n\n## found'],
    ['<p><a href="#missing"><em>x</em></a><em>!b</em></p>', '*x**!b*'],
    ['<p>x<a href="#missing"></a><strong>!b</strong></p>', 'x **!b**'],
    ['<p><em>x</em><a href="#missing"></a><em>!b</em></p>', '*x**!b*'],
    ['<p><em>x</em><a href="#one"></a><a href="#two"></a><em>!b</em></p>', '*x* *!b*'],
    ['<p><strong>b!</strong><a href="#missing"></a>c</p>', '**b!**c'],
    ['<p><strong>b!</strong><a href="#missing">c</a></p>', '**b!**c'],
    ['<p><strong>b!</strong><a href="#found">c</a></p><h2>found</h2>', '**b!**[c](#found)\n\n## found'],
    ['<p><a href="#missing">x</a><strong>!b</strong></p>', 'x**!b**'],
    ['<p><a href="#found">x</a><strong>!b</strong></p><h2>found</h2>', '[x](#found)**!b**\n\n## found'],
    ['<p>x<a href="#missing"><strong>!b</strong></a></p>', 'x **!b**'],
    ['<p><a href="#missing"><strong></strong></a>c</p>', 'c'],
    ['<p><a href="#missing"><strong>b!</strong> tail</a>c</p>', '**b!** tailc'],
    ['<p><a href="/external"><strong>b!</strong></a>c</p>', '[**b!**](/external)c'],
    ['<p><a href="#missing"><strong>b!</strong></a>c</p>', '**b!**c'],
    ['<p><a href="#found"><strong>b!</strong></a>c</p><h2>found</h2>', '[**b!**](#found)c\n\n## found'],
    ['<p><a href="#missing"><strong><em>b!</em></strong></a>c</p>', '***b!***c'],
  ])('keeps streaming parity after fragment cleanup in %s', async (html, expected) => {
    const options = { clean: clean({ fragments: true }) }
    expect(htmlToMarkdown(html, options)).toBe(expected)
    for (let width = 1; width <= html.length; width++) {
      const chunks: string[] = []
      for (let offset = 0; offset < html.length; offset += width)
        chunks.push(html.slice(offset, offset + width))
      let output = ''
      for await (const chunk of streamHtmlToMarkdown(toStream(chunks), options))
        output += chunk
      expect(output, `width=${width}`).toBe(expected)
    }
  })

  it('keeps cleaned heading links stable through long stream drains', async () => {
    const html = `<blockquote><p>before</p><h2><a href="#x">${'word '.repeat(2000)}<strong>b!</strong></a>c</h2><figure><figcaption>caption</figcaption></figure></blockquote><p>after</p>`
    const options = { clean: clean({ selfLinkHeadings: true }) }
    const expected = htmlToMarkdown(html, options)
    expect(expected).toContain('**b!**&#99;')
    for (const width of [1, 7, 1024]) {
      const chunks: string[] = []
      for (let offset = 0; offset < html.length; offset += width)
        chunks.push(html.slice(offset, offset + width))
      let output = ''
      for await (const chunk of streamHtmlToMarkdown(toStream(chunks), options))
        output += chunk
      expect(output, `width=${width}`).toBe(expected)
    }
  })

  it('keeps nested siblings consistent across stream drains', async () => {
    const fragment = '<p>a<strong><em><a href="/x">b</a></em></strong>c</p><p><strong><a href="/x">d</a></strong>e</p>'
    const html = fragment.repeat(128)
    const expected = Array.from({ length: 128 }).fill('a***[b](/x)***&#99;\n\n**[d](/x)**&#101;').join('\n\n')
    expect(htmlToMarkdown(html)).toBe(expected)
    for (const width of [1, 7, 64, 1024, 4096])
      expect(await streamConvert(html, width), `chunkSize=${width}`).toBe(expected)

    let consumed = 0
    const input = new ReadableStream<string>({
      pull(controller) {
        if (consumed === 128) {
          controller.close()
        }
        else {
          consumed++
          controller.enqueue(fragment)
        }
      },
    })
    let output = ''
    let firstYieldAt = 0
    for await (const chunk of streamHtmlToMarkdown(input)) {
      if (chunk && !firstYieldAt)
        firstYieldAt = consumed
      output += chunk
    }
    expect(firstYieldAt).toBeGreaterThan(0)
    expect(firstYieldAt).toBeLessThan(128)
    expect(output).toBe(expected)
  })

  it.each(cases)('converts %s', (html, expected) => {
    expect(htmlToMarkdown(html)).toBe(expected)
  })

  it.each(cases)('streams %s at every chunk size', async (html, expected) => {
    for (let chunkSize = 1; chunkSize <= html.length; chunkSize++)
      expect(await streamConvert(html, chunkSize), `chunkSize=${chunkSize}`).toBe(expected)
  })

  it('still yields emphasis content before the close', async () => {
    let feed!: ReadableStreamDefaultController<string>
    const input = new ReadableStream<string>({
      start(controller) {
        feed = controller
      },
    })
    const output = streamHtmlToMarkdown(input)[Symbol.asyncIterator]()
    feed.enqueue('<p>a<b><a href="/x">link</a><span>')
    const first = await output.next()
    expect(first.value).toContain('a<strong>[link](/x)')
    feed.enqueue('more</span></b>c</p>')
    feed.close()
    let rest = ''
    for (let chunk = await output.next(); !chunk.done; chunk = await output.next())
      rest += chunk.value
    expect(first.value + rest).toBe('a<strong>[link](/x)more</strong>c')
  })

  // A heading slug reads a character reference and a link's text as written,
  // so neither is used while fragment cleaning collects slugs; raw tags
  // outside a link are dropped from the slug.
  it('uses references and raw pairs in headings without fragment cleaning', () => {
    expect(htmlToMarkdown('<h2><strong><a href="/x">b</a></strong>c</h2>')).toBe('## **[b](/x)**&#99;')
    expect(htmlToMarkdown('<h2><a href="/x">a<strong>!b</strong></a></h2>')).toBe('## [a<strong>!b</strong>](/x)')
  })

  it.each([
    ['<h2><strong><a href="/x">b</a></strong>c</h2><p><a href="#bc">to</a></p>', '## **[b](/x)**c\n\n[to](#bc)'],
    ['<h2><a href="/y"><strong><code>b</code></strong>c</a></h2><p><a href="#bc">t</a></p>', '## [**`b`**c](/y)\n\n[t](#bc)'],
    ['<h2><a href="/x">a<strong>!b</strong></a></h2><p><a href="#ab">t</a></p>', '## [a**!b**](/x)\n\n[t](#ab)'],
    ['<h2>a<strong>!b</strong>c</h2><p><a href="#abc">t</a></p>', '## a<strong>!b</strong>c\n\n[t](#abc)'],
  ])('keeps the heading slug of %s', (html, expected) => {
    expect(htmlToMarkdown(html, { clean: clean() })).toBe(expected)
  })

  // `<b>b </b>c` writes its space after the closer; it breaks like any other
  // space between words.
  it.each([
    [6, '<p>1<strong>b </strong>x</p>', '1**b**\nx'],
    [80, '<p>1<strong>b </strong>x</p>', '1**b** x'],
    [12, '<p>a<strong>!bb </strong>&nbsp;c</p>', 'a<strong>!bb</strong>\n c'],
    [12, '<blockquote><blockquote>1<strong><del>b </del></strong>x</blockquote></blockquote>', '> > 1<strong>~~b~~</strong>\n> > x'],
  ] as [number, string, string][])('wraps at width %i the space after the closer in %s', (wrapWidth, html, expected) => {
    expect(htmlToMarkdown(html, { wrapWidth })).toBe(expected)
  })

  it('drops the space after a tilde only in Markdown', () => {
    // A strikethrough opener must touch its content; plain text has no
    // delimiters and keeps the separator.
    expect(htmlToMarkdown('<p>x~<q>q</q></p>')).toBe('x\\~"q"')
    expect(htmlToText('<p>x~<q>q</q></p>')).toBe('x~ "q"')
  })

  it('keeps delimiters where a fix cannot help', () => {
    // An opener before whitespace cannot open; a raw one at a block start
    // would open an HTML block.
    expect(htmlToMarkdown('<p><strong><br><a href="/x">b</a></strong>c</p>')).toBe('**  \n[b](/x)**&#99;')
    expect(htmlToMarkdown('<p>a<strong>&nbsp;<a href="/x">b</a></strong>c</p>')).toBe('a**  [b](/x)**&#99;')
    expect(htmlToMarkdown('<p><code>a<strong>[b]</strong>c</code></p>')).toBe('`a**[b]**c`')
    // `<kbd>`, `<samp>` and `<var>` are code spans as well.
    expect(htmlToMarkdown('<p><kbd><strong>b!</strong>c</kbd></p>')).toBe('`**b!**c`')
    expect(htmlToMarkdown('<p><kbd>a<strong>!b</strong></kbd></p>')).toBe('`a**!b**`')
    expect(htmlToMarkdown('<p><samp><em>(b)</em>c</samp></p>')).toBe('`*(b)*c`')
    expect(htmlToMarkdown('<p><var>a<em>!b</em>c</var></p>')).toBe('`a*!b*c`')
    expect(htmlToMarkdown('<p>a<strong><kbd>b</kbd></strong>c</p>')).toBe('a<strong>`b`</strong>c')
  })
})
