import { describe, expect, it } from 'vitest'
import { clean } from '../../src/clean'
import { htmlToMarkdown, streamHtmlToMarkdown } from '../../src/index'
import { htmlToText } from '../../src/text'

// CommonMark opens a delimiter run only when it is left-flanking and closes it
// only when it is right-flanking. An opener that cannot open turns its pair
// into raw HTML; a closer that cannot close is followed by a character
// reference, which starts with punctuation.
const cases: [string, string][] = [
  ['<p>a<strong><a href="/x">b</a></strong></p>', 'a<strong>[b](/x)</strong>'],
  ['<p><strong><a href="/x">b</a></strong>c</p>', '**[b](/x)**&#99;'],
  ['<p>a<b><a href="/x">b</a></b>c</p>', 'a<strong>[b](/x)</strong>c'],
  ['<p>a<em><img src="/i.png" alt="i"></em>c</p>', 'a<em>![i](/i.png)</em>c'],
  ['<p>a<i><code>x</code></i>c</p>', 'a<em>`x`</em>c'],
  ['<p>a<strong><em><a href="/x">b</a></em></strong>c</p>', 'a<strong>*[b](/x)*</strong>c'],
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

  // A heading's slug reads a character reference and a link's text as
  // written, so neither is used there; raw tags outside a link are dropped.
  it.each([
    ['<h2><strong><a href="/x">b</a></strong>c</h2><p><a href="#bc">to</a></p>', '## **[b](/x)**c\n\n[to](#bc)'],
    ['<h2><a href="/y"><strong><code>b</code></strong>c</a></h2><p><a href="#bc">t</a></p>', '## [**`b`**c](/y)\n\n[t](#bc)'],
    ['<h2><a href="/x">a<strong>!b</strong></a></h2><p><a href="#ab">t</a></p>', '## [a**!b**](/x)\n\n[t](#ab)'],
    ['<h2>a<strong>!b</strong>c</h2><p><a href="#abc">t</a></p>', '## a<strong>!b</strong>c\n\n[t](#abc)'],
  ])('keeps the heading slug of %s', (html, expected) => {
    expect(htmlToMarkdown(html, { clean: clean() })).toBe(expected)
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
    expect(htmlToMarkdown('<p><strong><br><a href="/x">b</a></strong>c</p>')).toBe('**  \n[b](/x)**c')
    expect(htmlToMarkdown('<p>a<strong>&nbsp;<a href="/x">b</a></strong>c</p>')).toBe('a**  [b](/x)**c')
    expect(htmlToMarkdown('<p><code>a<strong>[b]</strong>c</code></p>')).toBe('`a**[b]**c`')
    // `<kbd>`, `<samp>` and `<var>` are code spans as well.
    expect(htmlToMarkdown('<p><kbd><strong>b!</strong>c</kbd></p>')).toBe('`**b!**c`')
    expect(htmlToMarkdown('<p><kbd>a<strong>!b</strong></kbd></p>')).toBe('`a**!b**`')
    expect(htmlToMarkdown('<p><samp><em>(b)</em>c</samp></p>')).toBe('`*(b)*c`')
    expect(htmlToMarkdown('<p><var>a<em>!b</em>c</var></p>')).toBe('`a*!b*c`')
    expect(htmlToMarkdown('<p>a<strong><kbd>b</kbd></strong>c</p>')).toBe('a<strong>`b`</strong>c')
  })
})
