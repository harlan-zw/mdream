import { ReadableStream } from 'node:stream/web'
import { describe, expect, it } from 'vitest'
import { engines, resolveEngine } from '../../utils/engines'

type TestEngine = (typeof engines)[number]['engine']

// A delimiter run next to a word character on one side and punctuation on the
// other cannot flank. Both engines write the pair as raw HTML when its opener
// cannot open, and follow a closer that cannot close with a character reference.
const cases: [string, string][] = [
  ['<p>a<strong><a href="/x">b</a></strong></p>', 'a<strong>[b](/x)</strong>'],
  ['<p><strong><a href="/x">b</a></strong>c</p>', '**[b](/x)**&#99;'],
  ['<p>a<em><img src="/i.png" alt="i"></em>c</p>', 'a<em>![i](/i.png)</em>c'],
  ['<p>a<i><code>x</code></i>c</p>', 'a<em>`x`</em>c'],
  ['<p>a<strong><em><a href="/x">b</a></em></strong>c</p>', 'a<strong>*[b](/x)*</strong>c'],
  ['<p>a<del><a href="/x">b</a></del>c</p>', 'a ~~[b](/x)~~&#99;'],
  ['<p><strong>b!</strong>c</p>', '**b!**&#99;'],
  // A no-break space counts as whitespace, and an opener before whitespace
  // stays as written.
  ['<p>a&nbsp;<strong><a href="/x">b</a></strong>c</p>', 'a **[b](/x)**&#99;'],
  ['<p>a<strong>&nbsp;<a href="/x">b</a></strong>c</p>', 'a**  [b](/x)**c'],
  ['<blockquote><p>a<strong><a href="/x">b</a></strong>c</p></blockquote>', '> a<strong>[b](/x)</strong>c'],
  ['<ul><li>a<em><a href="/x">b</a></em>c</li></ul>', '- a<em>[b](/x)</em>c'],
  ['<p>a <strong><a href="/x">b</a></strong> c</p>', 'a **[b](/x)** c'],
  ['<p><a href="/y">a<strong>b!</strong></a>c</p>', '[a**b!**](/y)c'],
  // A block inside a decided pair leaves its closer to be written as decided.
  ['<div>a<strong><a href="/x">b</a><div>c</div></strong>d</div><p>next</p>', 'a<strong>[b](/x) c</strong>d\n\nnext'],
  ['<ul><li>a<strong><code>b</code><ul><li>c</li></ul></strong>d</li></ul><p>next</p>', '- a<strong>`b`  - c</strong>d\n\nnext'],
  ['<div>a<strong>!b<figure><figcaption>c</figcaption></figure></strong>d</div><p>next</p>', 'a<strong>!b*c*</strong>d\n\nnext'],
  ['<div>a<strong>b<div>c!</div></strong>d</div><p>next</p>', 'a**b c!**&#100;\n\nnext'],
  // `<kbd>`, `<samp>` and `<var>` are code spans, where delimiters are literal.
  ['<p><kbd><strong>b!</strong>c</kbd></p>', '`**b!**c`'],
  ['<p><kbd>a<strong>!b</strong></kbd></p>', '`a**!b**`'],
  ['<p><samp><em>(b)</em>c</samp></p>', '`*(b)*c`'],
  ['<p><var>a<em>!b</em>c</var></p>', '`a*!b*c`'],
  ['<p>a<strong><kbd>b</kbd></strong>c</p>', 'a<strong>`b`</strong>c'],
]

async function streamConvert(engine: TestEngine, html: string, chunkSize: number): Promise<string> {
  const stream = new ReadableStream<string>({
    start(controller) {
      for (let offset = 0; offset < html.length; offset += chunkSize)
        controller.enqueue(html.slice(offset, offset + chunkSize))
      controller.close()
    },
  })
  let output = ''
  for await (const chunk of engine.streamHtmlToMarkdown(stream))
    output += chunk
  return output
}

describe.each(engines)('emphasis that cannot flank $name', (engineConfig) => {
  it.each(cases)('converts %s', async (html, expected) => {
    const engine = await resolveEngine(engineConfig.engine)
    expect(engine.htmlToMarkdown(html)).toBe(expected)
  })

  it.each(cases)('streams %s at every chunk size', async (html, expected) => {
    const engine = await resolveEngine(engineConfig.engine)
    for (let chunkSize = 1; chunkSize <= html.length; chunkSize++)
      expect(await streamConvert(engine, html, chunkSize), `chunkSize=${chunkSize}`).toBe(expected)
  })
})
