import { describe, expect, it } from 'vitest'
import { htmlToMarkdown, streamHtmlToMarkdown } from '../../src/index'

describe('empty quotes opening list items', () => {
  for (const quote of ['<blockquote></blockquote>', '<blockquote><p></p></blockquote>', '<blockquote><div></div></blockquote>']) {
    it.each([
      ['<ul><li>', 'tail</li></ul>', '- tail'],
      ['<ul><li>', '<hr>tail</li></ul>', '- ***\n\n  tail'],
      ['<ul><li>x<ul><li>', '<hr>tail</li></ul></li></ul>', '- x\n  - ***\n\n    tail'],
      ['<ol start="10"><li>', 'tail</li></ol>', '10. tail'],
      ['<blockquote><ul><li>', '<hr>tail</li></ul></blockquote>', '> - ***\n>\n>   tail'],
    ])(`keeps content inside its item after ${quote}: %s`, async (before, after, expected) => {
      const html = before + quote + after
      expect(htmlToMarkdown(html)).toBe(expected)
      for (let split = 0; split <= html.length; split++) {
        const stream = new ReadableStream<string>({
          start(controller) {
            controller.enqueue(html.slice(0, split))
            controller.enqueue(html.slice(split))
            controller.close()
          },
        })
        let output = ''
        for await (const chunk of streamHtmlToMarkdown(stream))
          output += chunk
        expect(output, `split=${split}`).toBe(expected)
      }
    })
  }

  it.each([
    ['<blockquote><ul><li>a<blockquote></blockquote><blockquote>q</blockquote></li></ul></blockquote>', '> - a\n>   > q'],
    ['<blockquote><ul><li><hr><blockquote></blockquote><blockquote></blockquote>tail</li></ul></blockquote>', '> - ***\n>\n>   \n>\n>   tail'],
    ['<ul><li><hr><blockquote><blockquote><blockquote></blockquote><blockquote>q</blockquote></blockquote></blockquote></li></ul>', '- ***\n\n  \n  > > > q'],
    ['<ul><li><blockquote>x<hr></blockquote><blockquote><blockquote></blockquote><blockquote></blockquote><blockquote>q</blockquote></blockquote></li></ul>', '- \n  > x\n  >\n  > ---\n  > > q'],
    ['<li><blockquote/><em><pre><blockquote>', '-'],
    ['<ul><li>x<ul><li><blockquote><br></blockquote></li></ul><p>y</p></li></ul>', '- x\n\n  - \n  \n\n  y'],
    ['<ul><li><blockquote></blockquote><em><pre><blockquote></blockquote></pre></em></li></ul>', '-'],
    ['<ul><li><blockquote></blockquote><b><pre><code>x</code></pre></b></li></ul>', '- **`x`**'],
    ['<ul><li><blockquote></blockquote><em><pre><i><code>&#10;</code></i><h3>h</h3></pre></em></li></ul>', '- *`h`*'],
    ['<ul><li>x<ul><li><blockquote></blockquote></li></ul><p>y</p></li></ul>', '- x\n\n  - \n\n  y'],
  ])('preserves parent boundaries and fence content: %s', async (html, expected) => {
    expect(htmlToMarkdown(html)).toBe(expected)
    const stream = new ReadableStream<string>({
      start(controller) {
        for (const character of html)
          controller.enqueue(character)
        controller.close()
      },
    })
    let output = ''
    for await (const chunk of streamHtmlToMarkdown(stream))
      output += chunk
    expect(output).toBe(expected)
  })

  it('ignores empty quotes before visible continuations after streaming compaction', async () => {
    const lead = `<p>${'preceding text '.repeat(800)}</p>`
    for (const quote of ['<blockquote></blockquote>', '<blockquote><p></p></blockquote>', '<blockquote><div></div></blockquote>']) {
      for (const body of ['tail', '<hr>tail', '<p>tail</p>', '<h2>tail</h2>', '<em>tail</em>', '<pre><code>x</code></pre>', '<blockquote>q</blockquote>', '<span></span>tail']) {
        for (const [before, after] of [['<ul><li>', '</li><li>next</li></ul>'], ['<ul><li>x<ul><li>', '</li></ul><p>parent</p></li></ul>'], ['<ol start="10"><li>', '</li></ol>']]) {
          const html = `${lead}${before}${quote}${body}${after}`
          const expected = htmlToMarkdown(`${lead}${before}${body}${after}`)
          expect(htmlToMarkdown(html), before + quote + body + after).toBe(expected)
          for (const chunks of [[lead, ...(before + quote + body + after)], [`${lead}${before}<blockquote>`, quote.slice(12) + body + after]]) {
            const stream = new ReadableStream<string>({
              start(controller) {
                for (const chunk of chunks)
                  controller.enqueue(chunk)
                controller.close()
              },
            })
            let output = ''
            for await (const chunk of streamHtmlToMarkdown(stream))
              output += chunk
            expect(output, before + quote + body + after).toBe(expected)
          }
        }
      }
    }
  })
})
