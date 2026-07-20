import type { MdreamOptions } from '../../src/types'
import { describe, expect, it } from 'vitest'
import { htmlToMarkdown, streamHtmlToMarkdown } from '../../src/index'

async function streamConvert(html: string, split: number, options: Partial<MdreamOptions> = {}): Promise<string> {
  const stream = new ReadableStream<string>({
    start(controller) {
      controller.enqueue(html.slice(0, split))
      controller.enqueue(html.slice(split))
      controller.close()
    },
  })
  let output = ''
  for await (const chunk of streamHtmlToMarkdown(stream, options))
    output += chunk
  return output.trimEnd()
}

describe('blockquotes', () => {
  it.each([
    ['<blockquote><ul><li>one</li><li>two</li></ul></blockquote>', '> - one\n> - two'],
    ['<blockquote><ol><li>one</li><li>two</li></ol></blockquote>', '> 1. one\n> 2. two'],
    ['<blockquote><p>intro</p><ul><li>one</li></ul></blockquote>', '> intro\n>\n> - one'],
    ['<blockquote>text<h2>H</h2></blockquote>', '> text\n>\n> ## H'],
    ['<blockquote>a<hr>b</blockquote>', '> a\n>\n> ---\n> b'],
    ['<blockquote><div>a</div><div>b</div></blockquote>', '> a\n>\n> b'],
    ['<blockquote>lead<table><tr><td>a</td></tr></table>tail</blockquote>', '> lead\n>\n> | a |\n> | --- |\n>\n> tail'],
    ['<blockquote>lead<section>x</section>tail</blockquote>', '> lead\n>\n> x\n> tail'],
    ['<blockquote>lead<article>x</article>tail</blockquote>', '> lead\n>\n> x\n> tail'],
    ['<blockquote>lead<nav>x</nav>tail</blockquote>', '> lead\n>\n> x\n> tail'],
    ['<blockquote>lead<figure>x</figure>tail</blockquote>', '> lead\n>\n> x\n> tail'],
    ['<blockquote><p>literal &gt;</p></blockquote>', '> literal >'],
    ['<blockquote><table><tr><td>a</td></tr></table></blockquote>', '> | a |\n> | --- |'],
    ['<blockquote>literal &gt; <h2>H</h2></blockquote>', '> literal >\n>\n> ## H'],
    ['<blockquote><p>intro</p><p>&gt;</p></blockquote>', '> intro\n>\n> >'],
    ['<blockquote><pre><code>a\nb</code></pre></blockquote>', '> ```\n> a\n> b\n> ```'],
    ['<blockquote><pre><code>a\n\n\nb</code></pre></blockquote>', '> ```\n> a\n>\n>\n> b\n> ```'],
    ['<blockquote><p>a</p><p><strong></strong></p></blockquote>', '> a'],
    ['<blockquote><p>a</p><p><strong></strong>b</p></blockquote>', '> a\n>\n> b'],
    ['<blockquote><p>a</p><p><a href="https://e.test">https://e.test</a></p></blockquote>', '> a\n>\n> <https://e.test>'],
    ['<blockquote><ul><li>one<ul><li>sub</li></ul></li></ul></blockquote>', '> - one\n>   - sub'],
    ['<ul><li><blockquote><ul><li>x</li><li>y</li></ul></blockquote></li></ul>', '- \n  > - x\n  > - y'],
    ['<ul><li>intro<blockquote>quote</blockquote><span>credit</span></li></ul>', '- intro\n  > quote\n  credit'],
  ])('preserves block structure for %s', (html, expected) => {
    expect(htmlToMarkdown(html)).toBe(expected)
  })

  it('preserves quoted block structure across every stream split', async () => {
    const html = '<blockquote><p>intro</p><ul><li>one<ul><li>sub</li></ul></li><li>two</li></ul><table><tr><td>a</td></tr></table>tail</blockquote>'
    const expected = htmlToMarkdown(html)
    for (let split = 0; split <= html.length; split++)
      expect(await streamConvert(html, split), `split at byte ${split}`).toBe(expected)
  })

  it.each([
    ['empty inline block', '<blockquote><p>a</p><p><strong></strong></p></blockquote>', '> a'],
    ['empty marker before text', '<blockquote><p>a</p><p><strong></strong>b</p></blockquote>', '> a\n>\n> b'],
    ['autolink rewrite', '<blockquote><p>a</p><p><a href="https://e.test">https://e.test</a></p></blockquote>', '> a\n>\n> <https://e.test>'],
    ['repeated preformatted blank lines', '<blockquote><pre><code>a\n\n\nb</code></pre></blockquote>', '> ```\n> a\n>\n>\n> b\n> ```'],
    ['multiline tag output', '<blockquote><p>a<br>b</p></blockquote>', '> a\n> b'],
    [
      'mixed nested quote/list prefixes',
      '<ul><li><blockquote><p>outer</p><blockquote><p>inner</p><ul><li>item</li></ul></blockquote><p>tail</p></blockquote></li></ul>',
      '- \n  > outer\n  > > inner\n  > > - item\n  > tail',
    ],
  ])('preserves $0 across every stream split', async (_, html, expected) => {
    expect(htmlToMarkdown(html)).toBe(expected)
    for (let split = 0; split <= html.length; split++)
      expect(await streamConvert(html, split), `split at byte ${split}`).toBe(expected)
  })

  it('quotes every line of multiline hook output across every stream split', async () => {
    const html = '<blockquote><x-note></x-note></blockquote>'
    const expected = '> alpha\n> beta'
    const options: Partial<MdreamOptions> = {
      hooks: [{
        onNodeEnter(node) {
          return node.name === 'x-note' ? 'alpha\nbeta' : undefined
        },
      }],
    }
    expect(htmlToMarkdown(html, options)).toBe(expected)
    for (let split = 0; split <= html.length; split++)
      expect(await streamConvert(html, split, options), `split at byte ${split}`).toBe(expected)
  })

  it('keeps content after a quoted list block inside the list across every stream split', async () => {
    const html = '<ul><li>intro<blockquote>quote</blockquote><span>credit</span></li></ul>'
    const expected = '- intro\n  > quote\n  credit'
    for (let split = 0; split <= html.length; split++)
      expect(await streamConvert(html, split), `split at byte ${split}`).toBe(expected)
  })

  it('preserves the list continuation indent when post-quote text wraps', async () => {
    const html = '<ul><li>intro<blockquote>quote</blockquote><span>credit words continue after quote for wrapping</span></li></ul>'
    const expected = '- intro\n  > quote\n  credit words continue\n  after quote for\n  wrapping'
    expect(htmlToMarkdown(html, { wrapWidth: 24 })).toBe(expected)
    for (let split = 0; split <= html.length; split++)
      expect(await streamConvert(html, split, { wrapWidth: 24 }), `split at byte ${split}`).toBe(expected)
  })

  it.each([
    ['<blockquote><p>literal &gt;</p></blockquote>', '> literal >'],
    ['<blockquote><table><tr><td>a</td></tr></table></blockquote>', '> | a |\n> | --- |'],
    ['<blockquote>literal &gt; <h2>H</h2></blockquote>', '> literal >\n>\n> ## H'],
    ['<blockquote><p>intro</p><p>&gt;</p></blockquote>', '> intro\n>\n> >'],
  ])('does not stream a mutable trailing quote marker for %s', async (html, expected) => {
    for (let split = 0; split <= html.length; split++)
      expect(await streamConvert(html, split), `split at byte ${split}`).toBe(expected)
  })
})
