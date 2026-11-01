import { ReadableStream } from 'node:stream/web'
import { describe, expect, it } from 'vitest'
import { engines, resolveEngine } from '../../utils/engines'

type TestEngine = (typeof engines)[number]['engine']

// Closing delimiters use a reference before an ASCII word after punctuation.
// Opening-side cases retain their existing Markdown output.
const cases: [string, string][] = [
  ['<p><strong><a href="/x">b</a> </strong><kbd><b>c</b></kbd></p>', '**[b](/x)** `**c**`'],
  ['<p><strong><a href="/x">b</a> </strong><code><em>c</em></code></p>', '**[b](/x)** `*c*`'],
  ['<li>a<strong>(b)</strong><b>c</b></li>', '- a**(b)****c**'],
  ['<blockquote>a<strong>(b)</strong><b>c</b></blockquote>', '> a**(b)****c**'],
  ['<h2>a<strong>(b)</strong><b>c</b></h2>', '## a**(b)****c**'],
  ['<table><tr><td>a<strong>(b)</strong><b>c</b></td></tr></table>', '| a**(b)****c** |\n| --- |'],
  ['<a href="/y">a<strong>(b)</strong><b>c</b></a>', '[a**(b)****c**](/y)'],
  ['<ul><li><i><a href="/r">Sub (v.)</a></i></li><li><a href="/d"><strong>Domain</strong>/Super</a></li></ul>', '- *[Sub (v.)](/r)*\n- [**Domain**/Super](/d)'],
  ['<p><em><a href="/x">a</a></em><kbd><b>Ctrl</b></kbd></p>', '*[a](/x)*`**Ctrl**`'],
  ['<strong>b!</strong><code><em>c</em></code>', '**b!**`*c*`'],
  ['<p>a<strong>(b)</strong><b>c</b></p>', 'a**(b)****c**'],
  ['<p><strong><a href="/x">b</a> </strong><b>c</b></p>', '**[b](/x)** **c**'],
  ['<strong>b! </strong><em>c</em>', '**b!** *c*'],
  ['<p><em><a href="/x">a</a></em><code><em>x</em></code></p>', '*[a](/x)*`*x*`'],
  ['<p><em><a href="/x">a</a></em></p><p><code><em>x</em></code></p>', '*[a](/x)*\n\n`*x*`'],
  ['<p><em><a href="/x">a</a></em><samp><em>x</em></samp></p>', '*[a](/x)*`*x*`'],
  ['<p><em><a href="/x">a</a></em></p><p><samp><em>x</em></samp></p>', '*[a](/x)*\n\n`*x*`'],
  ['<p><em><a href="/x">a</a></em><var><em>x</em></var></p>', '*[a](/x)*`*x*`'],
  ['<p><em><a href="/x">a</a></em></p><p><var><em>x</em></var></p>', '*[a](/x)*\n\n`*x*`'],
  ['<p><em><a href="/x">a</a></em><kbd><em>x</em></kbd></p>', '*[a](/x)*`*x*`'],
  ['<p><em><a href="/x">a</a></em></p><p><kbd><em>x</em></kbd></p>', '*[a](/x)*\n\n`*x*`'],
  ['<p><strong>b!</strong><br><em>c</em>', '**b!**  \n*c*'],
  ['<p><strong>b!</strong></p><p><em>c</em>', '**b!**\n\n*c*'],
  ['<p><strong>b!</strong></p><h2><em>c</em>', '**b!**\n\n## *c*'],
  // Opening-side flanking is intentionally unchanged.
  ['<p>é<strong>!b</strong></p>', 'é**!b**'],
  // A dropped empty pair leaves the closer before it pending again.
  ['<p><strong>b!</strong><em></em>c</p>', '**b!**&#99;'],
  ['<p><strong>b!</strong><del></del>c</p>', '**b!**&#99;'],
  ['<p><strong>b!</strong><em> </em>c</p>', '**b!**&#99;'],
  ['<p><strong>b!</strong><em><b></b></em>c</p>', '**b!**&#99;'],
  ['<p><strong>b!</strong><code></code>c</p>', '**b!**&#99;'],
  ['<p>a<strong><em></em>(b)</strong>c</p>', 'a**(b)**&#99;'],
  ['<p><strong>b!</strong> <em></em>c</p>', '**b!** c'],
  ['<p><strong>b!</strong><em><b></b>x</em>c</p>', '**b!***x*c'],
  ['<p><i>a</i><b><a href="/y">x</a></b></p>', '*a***[x](/y)**'],
  ['<p><b><a href="/x">a</a></b><i>c</i></p>', '**[a](/x)***c*'],
  ['<p><b><i>a</i></b><b><a href="/y">x</a></b></p>', '***a*****[x](/y)**'],
  ['<p><b><a href="/x">a</a></b><b><i>c</i></b></p>', '**[a](/x)*****c***'],
  ['<p>a<strong><a href="/x">b</a></strong></p>', 'a**[b](/x)**'],
  ['<p><strong><a href="/x">b</a></strong>c</p>', '**[b](/x)**&#99;'],
  ['<p>a<em><img src="/i.png" alt="i"></em>c</p>', 'a*![i](/i.png)*&#99;'],
  ['<p>a<i><code>x</code></i>c</p>', 'a*`x`*&#99;'],
  ['<p>a<strong><em><a href="/x">b</a></em></strong>c</p>', 'a***[b](/x)***&#99;'],
  ['<p>a<del><a href="/x">b</a></del>c</p>', 'a ~~[b](/x)~~&#99;'],
  ['<p><strong>b!</strong>c</p>', '**b!**&#99;'],
  // A no-break space counts as whitespace, and an opener before whitespace
  // stays as written.
  ['<p>a&nbsp;<strong><a href="/x">b</a></strong>c</p>', 'a **[b](/x)**&#99;'],
  ['<p>a<strong>&nbsp;<a href="/x">b</a></strong>c</p>', 'a**  [b](/x)**&#99;'],
  ['<blockquote><p>a<strong><a href="/x">b</a></strong>c</p></blockquote>', '> a**[b](/x)**&#99;'],
  ['<ul><li>a<em><a href="/x">b</a></em>c</li></ul>', '- a*[b](/x)*&#99;'],
  ['<p>a <strong><a href="/x">b</a></strong> c</p>', 'a **[b](/x)** c'],
  ['<p><a href="/y">a<strong>b!</strong></a>c</p>', '[a**b!**](/y)c'],
  // Blocks inside emphasis preserve the existing Markdown delimiters.
  ['<div>a<strong><a href="/x">b</a><div>c</div></strong>d</div><p>next</p>', 'a**[b](/x) c**d\n\nnext'],
  ['<ul><li>a<strong><code>b</code><ul><li>c</li></ul></strong>d</li></ul><p>next</p>', '- a**`b`  - c**d\n\nnext'],
  ['<div>a<strong>!b<figure><figcaption>c</figcaption></figure></strong>d</div><p>next</p>', 'a**!b*c***d\n\nnext'],
  ['<div>a<strong>b<div>c!</div></strong>d</div><p>next</p>', 'a**b c!**&#100;\n\nnext'],
  // `<kbd>`, `<samp>` and `<var>` are code spans, where delimiters are literal.
  ['<p><kbd><strong>b!</strong>c</kbd></p>', '`**b!**c`'],
  ['<p><kbd>a<strong>!b</strong></kbd></p>', '`a**!b**`'],
  ['<p><samp><em>(b)</em>c</samp></p>', '`*(b)*c`'],
  ['<p><var>a<em>!b</em>c</var></p>', '`a*!b*c`'],
  ['<p>a<strong><kbd>b</kbd></strong>c</p>', 'a**`b`**&#99;'],
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
  it.each([
    ['<p><em><a href="/x">a</a></em></p><h2><strong>Intro</strong></h2><p><a href="#intro">go</a></p>', '*[a](/x)*\n\n## **Intro**\n\n[go](#intro)'],
    ['<strong>b!</strong><h2><em>c</em></h2><a href="#c">link</a>', '**b!**\n\n## *c*\n\n[link](#c)'],
  ])('keeps fragment links after an earlier closer in %s', async (html, expected) => {
    const engine = await resolveEngine(engineConfig.engine)
    for (const fragmentsOnly of [false, true]) {
      const options = { clean: fragmentsOnly ? { fragments: true } : true }
      expect(engine.htmlToMarkdown(html, options)).toBe(expected)
      for (let width = 1; width <= html.length; width++) {
        const input = new ReadableStream<string>({
          start(controller) {
            for (let offset = 0; offset < html.length; offset += width)
              controller.enqueue(html.slice(offset, offset + width))
            controller.close()
          },
        })
        let output = ''
        for await (const chunk of engine.streamHtmlToMarkdown(input, options))
          output += chunk
        expect(output, `width=${width}`).toBe(expected)
      }
    }
  })

  it.each(['em', 'i', 'cite', 'strong', 'b', 'dfn', 'del'])('leaves %s literal exits unchanged before a vertical-tab suffix', async (tag) => {
    const engine = await resolveEngine(engineConfig.engine)
    const strong = tag === 'strong' || tag === 'b' || tag === 'dfn'
    const html = `a<${tag}>!b</${tag}>c`
    for (const suffix of ['\v', '\v ', '\v\n']) {
      const delimiter = tag === 'del' ? '~~' : strong ? '**' : '*'
      const options = { plugins: { tagOverrides: { [tag]: { exit: `${delimiter}${suffix}` } } } }
      // Strikethrough inserts a space before its opener and remains Markdown.
      const expected = tag === 'del' ? `a ~~!b~~${suffix}c` : `a${delimiter}!b${delimiter}${suffix}c`
      expect(engine.htmlToMarkdown(html, options)).toBe(expected)
      for (let width = 1; width <= html.length; width++) {
        const input = new ReadableStream<string>({
          start(controller) {
            for (let offset = 0; offset < html.length; offset += width)
              controller.enqueue(html.slice(offset, offset + width))
            controller.close()
          },
        })
        let output = ''
        for await (const chunk of engine.streamHtmlToMarkdown(input, options))
          output += chunk
        expect(output).toBe(expected)
      }
    }
  })

  it('keeps adjacent delimiter runs unchanged across flushes', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const run = '*'.repeat(32)
    const options = { plugins: { tagOverrides: { span: { enter: run } } } }
    const parts = ['<p>a<span></span>', '<b>', '<a href="/y">x</a></b></p>']
    const expected = `a${run}**[x](/y)**`
    expect(engine.htmlToMarkdown(parts.join(''), options)).toBe(expected)
    const stream = new ReadableStream<string>({
      start(controller) {
        for (const part of parts)
          controller.enqueue(part)
        controller.close()
      },
    })
    let output = ''
    for await (const chunk of engine.streamHtmlToMarkdown(stream, options))
      output += chunk
    expect(output).toBe(expected)
  })

  it.each(cases)('converts %s', async (html, expected) => {
    const engine = await resolveEngine(engineConfig.engine)
    expect(engine.htmlToMarkdown(html)).toBe(expected)
  })

  it.each(cases)('streams %s at every chunk size', async (html, expected) => {
    const engine = await resolveEngine(engineConfig.engine)
    for (let chunkSize = 1; chunkSize <= html.length; chunkSize++)
      expect(await streamConvert(engine, html, chunkSize), `chunkSize=${chunkSize}`).toBe(expected)
  })

  // Fragment cleaning reads a reference the converter wrote as its character,
  // so headings keep both the reference and their slug.
  it('uses closer references in headings without fragment cleaning', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    expect(engine.htmlToMarkdown('<h2><strong><a href="/x">b</a></strong>c</h2>')).toBe('## **[b](/x)**&#99;')
    expect(engine.htmlToMarkdown('<h2><a href="/x">a<strong>!b</strong></a></h2>')).toBe('## [a**!b**](/x)')
  })

  it.each([
    ['<h2><strong><a href="/x">b</a></strong>c</h2><p><a href="#bc">to</a></p>', '## **[b](/x)**&#99;\n\n[to](#bc)'],
    ['<h2><a href="/y"><strong><code>b</code></strong>c</a></h2><p><a href="#bc">t</a></p>', '## [**`b`**&#99;](/y)\n\n[t](#bc)'],
    ['<h2><a href="/x">a<strong>!b</strong></a></h2><p><a href="#ab">t</a></p>', '## [a**!b**](/x)\n\n[t](#ab)'],
    ['<h2>a<strong>!b</strong>c</h2><p><a href="#abc">t</a></p>', '## a**!b**c\n\n[t](#abc)'],
  ])('keeps the heading slug of %s', async (html, expected) => {
    const engine = await resolveEngine(engineConfig.engine)
    expect(engine.htmlToMarkdown(html, { clean: true })).toBe(expected)
  })

  // Only the references the converter writes read back as characters: an
  // escaped `\&` and code keep the slug they always had.
  it.each([
    ['<h2><strong>b!</strong>c</h2><p><a href="#bc">to</a></p>', [{ fragments: true }, true], '## **b!**&#99;\n\n[to](#bc)'],
    ['<h2><em>v:</em>7</h2><p><a href="#v7">to</a></p>', [{ fragments: true }, true], '## *v:*&#55;\n\n[to](#v7)'],
    ['<h2><strong>b!</strong>C</h2><p><a href="#bc">to</a></p>', [{ fragments: true }, true], '## **b!**&#67;\n\n[to](#bc)'],
    ['<h2><del>b!</del>c</h2><p><a href="#bc">to</a></p>', [{ fragments: true }, true], '## ~~b!~~&#99;\n\n[to](#bc)'],
    ['<h2>é<strong>ç!</strong>c</h2><p><a href="#c">to</a></p>', [{ fragments: true }, true], '## é**ç!**&#99;\n\n[to](#c)'],
    ['<h2><strong>b!</strong><a href="#missing">c</a></h2><p><a href="#bc">to</a></p>', [{ fragments: true }, true], '## **b!**&#99;\n\n[to](#bc)'],
    ['<h2><strong><a href="#b">b!</a></strong>c</h2><p><a href="#bc">to</a></p>', [{ selfLinkHeadings: true }, true], '## **b!**&#99;\n\n[to](#bc)'],
    ['<h2><strong>b!</strong><a href="#x">c</a></h2><p><a href="#bc">to</a></p>', [{ selfLinkHeadings: true }, true], '## **b!**&#99;\n\n[to](#bc)'],
    ['<h2><strong>b!</strong><a href="https://x.com">https://x.com</a></h2><p><a href="#bhttpsxcom">to</a></p>', [{ redundantLinks: true }, true], '## **b!**&#104;ttps://x.com\n\n[to](#bhttpsxcom)'],
    ['<h2><strong><a href="https://x.com/">https://x.com/</a></strong>c</h2><p><a href="#httpsxcomc">to</a></p>', [{ redundantLinks: true }, true], '## **https://x.com/**&#99;\n\n[to](#httpsxcomc)'],
    ['<h2><strong>b!</strong>&amp;#99;</h2><p><a href="#b99">x</a> <a href="#bc">y</a></p>', [{ fragments: true }, true], '## **b!**\\&#99;\n\n[x](#b99) y'],
    ['<h2><strong>b!</strong><code>*&amp;#99;</code></h2><p><a href="#b99">x</a> <a href="#bc">y</a></p>', [{ fragments: true }, true], '## **b!**`*&#99;`\n\n[x](#b99) y'],
    ['<h2><a href="/x"><code>*&amp;#99;</code></a></h2><p><a href="#99">x</a> <a href="#c">y</a></p>', [{ fragments: true }, true], '## [`*&#99;`](/x)\n\n[x](#99) y'],
    ['<h2><a href="/x">`<strong>b!</strong>c</a></h2><p><a href="#bc">to</a></p>', [{ fragments: true }, true], '## [\\`**b!**&#99;](/x)\n\n[to](#bc)'],
    ['<h2><a href="/x"><code>a\\</code><strong>b!</strong>c</a></h2><p><a href="#abc">to</a></p>', [{ fragments: true }, true], '## [`a\\`**b!**&#99;](/x)\n\n[to](#abc)'],
  ] as [string, (true | Record<string, boolean>)[], string][])('keeps closer references and slugs in the heading of %s', async (html, rules, expected) => {
    const engine = await resolveEngine(engineConfig.engine)
    for (const clean of rules) {
      const options = { clean }
      expect(engine.htmlToMarkdown(html, options)).toBe(expected)
      for (let width = 1; width <= html.length; width++) {
        const input = new ReadableStream<string>({
          start(controller) {
            for (let offset = 0; offset < html.length; offset += width)
              controller.enqueue(html.slice(offset, offset + width))
            controller.close()
          },
        })
        let output = ''
        for await (const chunk of engine.streamHtmlToMarkdown(input, options))
          output += chunk
        expect(output, `width=${width} clean=${JSON.stringify(clean)}`).toBe(expected)
      }
    }
  })

  // `<b>b </b>c` writes its space after the closer; it breaks like any other
  // space between words.
  it.each([
    [6, '<p>1<strong>b </strong>x</p>', '1**b**\nx'],
    [80, '<p>1<strong>b </strong>x</p>', '1**b** x'],
    [12, '<p>a<strong>!bb </strong>&nbsp;c</p>', 'a**!bb**  c'],
    [12, '<blockquote><blockquote>1<strong><del>b </del></strong>x</blockquote></blockquote>', '> > 1**~~b~~** x'],
  ] as [number, string, string][])('wraps at width %i the space after the closer in %s', async (wrapWidth, html, expected) => {
    const engine = await resolveEngine(engineConfig.engine)
    expect(engine.htmlToMarkdown(html, { wrapWidth })).toBe(expected)
  })

  // A separator before the word already lets the closer flank, wrapped or not.
  it.each([
    ['<table><tr><td><em>b.</em><div>c</div></td></tr></table>', '| *b.* c |\n| --- |'],
    ['<p>1<strong>b. </strong>x</p>', '1**b.** x'],
    ['<p><strong>b!</strong> <em></em>c</p>', '**b!** c'],
    ['<p><strong>b!</strong>c</p>', '**b!**&#99;'],
  ])('wraps %s like unwrapped output', async (html, expected) => {
    const engine = await resolveEngine(engineConfig.engine)
    for (const options of [{}, { wrapWidth: 20 }]) {
      expect(engine.htmlToMarkdown(html, options)).toBe(expected)
      for (let width = 1; width <= html.length; width++) {
        const input = new ReadableStream<string>({
          start(controller) {
            for (let offset = 0; offset < html.length; offset += width)
              controller.enqueue(html.slice(offset, offset + width))
            controller.close()
          },
        })
        let output = ''
        for await (const chunk of engine.streamHtmlToMarkdown(input, options))
          output += chunk
        expect(output, `width=${width} options=${JSON.stringify(options)}`).toBe(expected)
      }
    }
  })

  it('wraps at a space moved past an inline close in plain text', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    expect(engine.htmlToMarkdown('<p>w <em>lo b Hel<span></span> </em>xx</p>', { format: 'text', wrapWidth: 12 })).toBe('w lo b Hel\nxx')
  })

  it('keeps the separator after a literal tilde', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    expect(engine.htmlToMarkdown('<p>x~<q>q</q></p>')).toBe('x\\~ "q"')
    expect(engine.htmlToMarkdown('<p>x~<q>q</q></p>', { format: 'text' })).toBe('x~ "q"')
  })

  // The separator after a strikethrough closer keeps it flanking once
  // cleanup removes the link that followed it.
  it.each([
    ['<p><del>b!</del><a href="#missing">c</a></p>', { fragments: true }, '~~b!~~ c'],
    ['<p><del>b!</del><a href="#missing">c</a></p>', true, '~~b!~~ c'],
    ['<p><s>Old price!</s><a href="#note">New</a></p>', { fragments: true }, '~~Old price!~~ New'],
    ['<p><del>a<code>b</code></del><a href="#missing">c</a></p>', { fragments: true }, '~~a`b`~~ c'],
    ['<p><del>b!</del><a href="c">c</a></p>', { redundantLinks: true }, '~~b!~~ c'],
    ['<h2 id="x"><del>b!</del><a href="#x">c</a></h2>', { selfLinkHeadings: true }, '## ~~b!~~ c'],
    ['<h2 id="x"><del>b!</del><a href="#x">c</a></h2>', true, '## ~~b!~~ c'],
    ['<p><del>b</del><a href="/c">c</a></p>', { fragments: true }, '~~b~~ [c](/c)'],
    // An open ancestor is not a pending opener.
    ['<p><em><s>b!</s><a href="#missing">c</a></em></p>', { fragments: true }, '*~~b!~~ c*'],
    ['<p><em> <s>b!</s><a href="#missing">c</a></em></p>', { fragments: true }, '*~~b!~~ c*'],
    ['<p><em><s><a href="#missing">b</a></s>c</em></p>', { fragments: true }, '*~~b~~&#99;*'],
    ['<p><em><s><a href="/x">b</a></s>c</em></p>', { fragments: true }, '*~~[b](/x)~~&#99;*'],
  ] as [string, true | Record<string, boolean>, string][])('keeps strikethrough before a cleaned link in %s', async (html, clean, expected) => {
    const engine = await resolveEngine(engineConfig.engine)
    const options = { clean }
    expect(engine.htmlToMarkdown(html, options)).toBe(expected)
    for (let width = 1; width <= html.length; width++) {
      const input = new ReadableStream<string>({
        start(controller) {
          for (let offset = 0; offset < html.length; offset += width)
            controller.enqueue(html.slice(offset, offset + width))
          controller.close()
        },
      })
      let output = ''
      for await (const chunk of engine.streamHtmlToMarkdown(input, options))
        output += chunk
      expect(output, `width=${width}`).toBe(expected)
    }
  })

  // A closer the removed link separated from the next word references the
  // word, in either nesting order, only when the link is gone.
  it.each([
    ['<p><strong>b!</strong><a href="#missing">c</a></p>', { fragments: true }, '**b!**&#99;'],
    ['<p><a href="#missing"><strong>b!</strong></a>c</p>', { fragments: true }, '**b!**&#99;'],
    ['<p><strong>b!</strong><a href="#missing">c</a></p>', true, '**b!**&#99;'],
    ['<p><a href="#missing"><strong>b!</strong></a>c</p>', true, '**b!**&#99;'],
    ['<p><strong>b!</strong><a href="#missing">c</a></p>', { redundantLinks: true }, '**b!**[c](#missing)'],
    ['<p><a href="#missing"><strong>b!</strong></a>c</p>', { redundantLinks: true }, '[**b!**](#missing)c'],
    ['<p><strong>b!</strong><a href="#found">c</a></p><h2>found</h2>', { fragments: true }, '**b!**[c](#found)\n\n## found'],
    ['<p><strong>b!</strong><a href="#missing">é</a></p>', { fragments: true }, '**b!**é'],
    ['<p><a href="#missing"><strong>b!</strong></a>é</p>', { fragments: true }, '**b!**é'],
    ['<p><a href="#missing"><strong>b!</strong></a></p>', { fragments: true }, '**b!**'],
  ] as [string, true | Record<string, boolean>, string][])('references the word after a closer once cleanup removes a link in %s', async (html, clean, expected) => {
    const engine = await resolveEngine(engineConfig.engine)
    const options = { clean }
    expect(engine.htmlToMarkdown(html, options)).toBe(expected)
    for (let width = 1; width <= html.length; width++) {
      const input = new ReadableStream<string>({
        start(controller) {
          for (let offset = 0; offset < html.length; offset += width)
            controller.enqueue(html.slice(offset, offset + width))
          controller.close()
        },
      })
      let output = ''
      for await (const chunk of engine.streamHtmlToMarkdown(input, options))
        output += chunk
      expect(output, `width=${width}`).toBe(expected)
    }
  })
})
