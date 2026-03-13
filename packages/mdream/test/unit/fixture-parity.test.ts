import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { ReadableStream } from 'node:stream/web'
import { describe, expect, it } from 'vitest'
import { engines, resolveEngine } from '../utils/engines'

const fixturesDir = resolve(import.meta.dirname, '../fixtures')

const fixtures = [
  { name: 'wikipedia-small.html', label: 'Small (166 KB)', minOutputKB: 5 },
  { name: 'github-markdown-complete.html', label: 'Medium (420 KB)', minOutputKB: 10 },
  { name: 'wikipedia-largest.html', label: 'Large (1.8 MB)', minOutputKB: 50 },
] as const

function stringToStream(str: string, chunkSize = 16384): ReadableStream<string> {
  return new ReadableStream({
    start(controller) {
      for (let i = 0; i < str.length; i += chunkSize)
        controller.enqueue(str.slice(i, i + chunkSize))
      controller.close()
    },
  })
}

async function collectStream(stream: AsyncIterable<string>): Promise<string> {
  const chunks: string[] = []
  for await (const chunk of stream)
    chunks.push(chunk)
  return chunks.join('')
}

for (const { name: engineName, engine: engineThunk } of engines) {
  describe(`${engineName} - fixture parity`, () => {
    for (const { name: fixtureName, label, minOutputKB } of fixtures) {
      describe(`${label} (${fixtureName})`, () => {
        const html = readFileSync(resolve(fixturesDir, fixtureName), 'utf-8')

        it('string conversion produces meaningful output', async () => {
          const engine = await resolveEngine(engineThunk)
          const md = engine.htmlToMarkdown(html).markdown
          expect(md.length).toBeGreaterThan(minOutputKB * 1024)
        })

        it('streaming conversion produces meaningful output', async () => {
          const engine = await resolveEngine(engineThunk)
          const md = await collectStream(engine.streamHtmlToMarkdown(stringToStream(html)))
          expect(md.length).toBeGreaterThan(minOutputKB * 1024)
        })

        it('string and streaming output match', async () => {
          const engine = await resolveEngine(engineThunk)
          const stringResult = engine.htmlToMarkdown(html).markdown
          const streamResult = await collectStream(engine.streamHtmlToMarkdown(stringToStream(html)))
          // Streaming may produce trailing whitespace from final flush
          expect(streamResult.trimEnd()).toBe(stringResult.trimEnd())
        })
      })
    }
  })
}

describe('cross-engine parity', () => {
  for (const { name: fixtureName, label } of fixtures) {
    it(`${label} - JS and Rust produce equivalent output`, async () => {
      const html = readFileSync(resolve(fixturesDir, fixtureName), 'utf-8')
      const [jsEngine, rustEngine] = await Promise.all([
        resolveEngine(engines[0].engine),
        resolveEngine(engines[1].engine),
      ])
      const jsResult = jsEngine.htmlToMarkdown(html).markdown
      const rustResult = rustEngine.htmlToMarkdown(html).markdown
      // Both engines should produce non-empty output
      expect(jsResult.length).toBeGreaterThan(0)
      expect(rustResult.length).toBeGreaterThan(0)
      // Engines should produce near-identical output (within 1%)
      const ratio = rustResult.length / jsResult.length
      expect(ratio).toBeGreaterThan(0.99)
      expect(ratio).toBeLessThan(1.01)
    })

    it(`${label} - heading structure matches across engines`, async () => {
      const html = readFileSync(resolve(fixturesDir, fixtureName), 'utf-8')
      const [jsEngine, rustEngine] = await Promise.all([
        resolveEngine(engines[0].engine),
        resolveEngine(engines[1].engine),
      ])
      const jsResult = jsEngine.htmlToMarkdown(html).markdown
      const rustResult = rustEngine.htmlToMarkdown(html).markdown
      const headingRegex = /^#{1,6} .+$/gm
      const jsHeadings = jsResult.match(headingRegex) || []
      const rustHeadings = rustResult.match(headingRegex) || []
      // Heading count and levels should match; content may differ due to entity decoding gaps
      expect(rustHeadings.length).toBe(jsHeadings.length)
      for (let i = 0; i < jsHeadings.length; i++) {
        const jsLevel = jsHeadings[i].match(/^#+/)![0].length
        const rustLevel = rustHeadings[i].match(/^#+/)![0].length
        expect(rustLevel, `Heading level mismatch at index ${i}`).toBe(jsLevel)
      }
    })

    it(`${label} - link count matches across engines`, async () => {
      const html = readFileSync(resolve(fixturesDir, fixtureName), 'utf-8')
      const [jsEngine, rustEngine] = await Promise.all([
        resolveEngine(engines[0].engine),
        resolveEngine(engines[1].engine),
      ])
      const jsResult = jsEngine.htmlToMarkdown(html).markdown
      const rustResult = rustEngine.htmlToMarkdown(html).markdown
      const linkRegex = /\[([^\]]*)\]\([^)]+\)/g
      const jsLinks = jsResult.match(linkRegex) || []
      const rustLinks = rustResult.match(linkRegex) || []
      // Link counts should be within 2% of each other
      expect(Math.abs(jsLinks.length - rustLinks.length) / Math.max(jsLinks.length, 1)).toBeLessThan(0.02)
    })
  }

  it('simple HTML produces identical output', async () => {
    const [jsEngine, rustEngine] = await Promise.all([
      resolveEngine(engines[0].engine),
      resolveEngine(engines[1].engine),
    ])
    const cases = [
      '<h1>Hello</h1><p>World</p>',
      '<ul><li>one</li><li>two</li><li>three</li></ul>',
      '<a href="https://example.com">link</a>',
      '<strong>bold</strong> and <em>italic</em>',
      '<blockquote><p>quoted text</p></blockquote>',
      '<pre><code>code block</code></pre>',
      '<h2>Title</h2><p>Paragraph with <a href="/path">relative link</a>.</p>',
    ]
    for (const html of cases) {
      const jsResult = jsEngine.htmlToMarkdown(html).markdown.trimEnd()
      const rustResult = rustEngine.htmlToMarkdown(html).markdown.trimEnd()
      expect(rustResult, `Mismatch for: ${html}`).toBe(jsResult)
    }
  })

  it('headings produce identical output', async () => {
    const [jsEngine, rustEngine] = await Promise.all([
      resolveEngine(engines[0].engine),
      resolveEngine(engines[1].engine),
    ])
    const cases = [
      '<h1>Title</h1>',
      '<h2>Subtitle</h2>',
      '<h3>Section</h3>',
      '<h4>Subsection</h4>',
      '<h5>Minor</h5>',
      '<h6>Smallest</h6>',
      '<h2>Heading with <strong>bold</strong></h2>',
      '<h2>Heading with <em>italic</em></h2>',
      '<h2>Heading with <code>code</code></h2>',
      '<a href="/link"><h2>Heading inside link</h2></a>',
    ]
    for (const html of cases) {
      const jsResult = jsEngine.htmlToMarkdown(html).markdown.trimEnd()
      const rustResult = rustEngine.htmlToMarkdown(html).markdown.trimEnd()
      expect(rustResult, `Heading mismatch for: ${html}`).toBe(jsResult)
    }
  })

  it('inline formatting produces identical output', async () => {
    const [jsEngine, rustEngine] = await Promise.all([
      resolveEngine(engines[0].engine),
      resolveEngine(engines[1].engine),
    ])
    const cases = [
      '<p><strong>bold</strong></p>',
      '<p><b>bold</b></p>',
      '<p><em>italic</em></p>',
      '<p><i>italic</i></p>',
      '<p><del>strikethrough</del></p>',
      '<p><code>inline code</code></p>',
      '<p><sub>subscript</sub></p>',
      '<p><sup>superscript</sup></p>',
      '<p><ins>inserted</ins></p>',
      '<p><mark>highlighted</mark></p>',
      '<p><u>underline</u></p>',
      '<p><kbd>Ctrl+C</kbd></p>',
      '<p><samp>output</samp></p>',
      '<p><var>x</var></p>',
      '<p><cite>citation</cite></p>',
      '<p><dfn>definition</dfn></p>',
      '<p><q>quoted</q></p>',
      '<p><b><b>nested bold</b></b></p>',
      '<p><i><i>nested italic</i></i></p>',
      '<p><strong>bold and <em>italic</em></strong></p>',
    ]
    for (const html of cases) {
      const jsResult = jsEngine.htmlToMarkdown(html).markdown.trimEnd()
      const rustResult = rustEngine.htmlToMarkdown(html).markdown.trimEnd()
      expect(rustResult, `Inline mismatch for: ${html}`).toBe(jsResult)
    }
  })

  it('links produce identical output', async () => {
    const [jsEngine, rustEngine] = await Promise.all([
      resolveEngine(engines[0].engine),
      resolveEngine(engines[1].engine),
    ])
    const cases = [
      '<a href="https://example.com">simple link</a>',
      '<a href="/relative">relative</a>',
      '<a href="#anchor">anchor</a>',
      '<a href="//cdn.example.com/file">protocol-relative</a>',
      '<a href="https://example.com" title="Example">with title</a>',
      '<a href="/path"><strong>bold link</strong></a>',
      '<a href="/path"><em>italic link</em></a>',
      '<p>Text with <a href="/link">inline link</a> in paragraph.</p>',
      '<a href="https://example.com/path?q=1&amp;r=2">encoded url</a>',
    ]
    for (const html of cases) {
      const jsResult = jsEngine.htmlToMarkdown(html).markdown.trimEnd()
      const rustResult = rustEngine.htmlToMarkdown(html).markdown.trimEnd()
      expect(rustResult, `Link mismatch for: ${html}`).toBe(jsResult)
    }
  })

  it('images produce identical output', async () => {
    const [jsEngine, rustEngine] = await Promise.all([
      resolveEngine(engines[0].engine),
      resolveEngine(engines[1].engine),
    ])
    const cases = [
      '<img src="/image.png" alt="alt text" />',
      '<img src="https://example.com/img.jpg" alt="" />',
      '<img src="/photo.webp" />',
      '<p>Text with <img src="/inline.png" alt="inline" /> image.</p>',
    ]
    for (const html of cases) {
      const jsResult = jsEngine.htmlToMarkdown(html).markdown.trimEnd()
      const rustResult = rustEngine.htmlToMarkdown(html).markdown.trimEnd()
      expect(rustResult, `Image mismatch for: ${html}`).toBe(jsResult)
    }
  })

  it('lists produce identical output', async () => {
    const [jsEngine, rustEngine] = await Promise.all([
      resolveEngine(engines[0].engine),
      resolveEngine(engines[1].engine),
    ])
    const cases = [
      '<ul><li>one</li><li>two</li><li>three</li></ul>',
      '<ol><li>first</li><li>second</li><li>third</li></ol>',
      '<ul><li>parent<ul><li>child</li></ul></li></ul>',
      '<ol><li>parent<ol><li>child</li></ol></li></ol>',
      '<ul><li>mixed<ol><li>nested ordered</li></ol></li></ul>',
      '<ul><li><strong>bold item</strong></li><li><em>italic item</em></li></ul>',
      '<ul><li>item with <a href="/link">link</a></li></ul>',
    ]
    for (const html of cases) {
      const jsResult = jsEngine.htmlToMarkdown(html).markdown.trimEnd()
      const rustResult = rustEngine.htmlToMarkdown(html).markdown.trimEnd()
      expect(rustResult, `List mismatch for: ${html}`).toBe(jsResult)
    }
  })

  it('tables produce identical output', async () => {
    const [jsEngine, rustEngine] = await Promise.all([
      resolveEngine(engines[0].engine),
      resolveEngine(engines[1].engine),
    ])
    const cases = [
      '<table><tr><th>A</th><th>B</th></tr><tr><td>1</td><td>2</td></tr></table>',
      '<table><thead><tr><th>Name</th><th>Value</th></tr></thead><tbody><tr><td>foo</td><td>bar</td></tr></tbody></table>',
      '<table><tr><th align="left">Left</th><th align="center">Center</th><th align="right">Right</th></tr><tr><td>a</td><td>b</td><td>c</td></tr></table>',
      '<table><tr><th>Header</th></tr><tr><td><strong>bold cell</strong></td></tr></table>',
      '<table><tr><th>Header</th></tr><tr><td>pipe | in cell</td></tr></table>',
    ]
    for (const html of cases) {
      const jsResult = jsEngine.htmlToMarkdown(html).markdown.trimEnd()
      const rustResult = rustEngine.htmlToMarkdown(html).markdown.trimEnd()
      expect(rustResult, `Table mismatch for: ${html}`).toBe(jsResult)
    }
  })

  it('blockquotes produce identical output', async () => {
    const [jsEngine, rustEngine] = await Promise.all([
      resolveEngine(engines[0].engine),
      resolveEngine(engines[1].engine),
    ])
    const cases = [
      '<blockquote>simple quote</blockquote>',
      '<blockquote><p>paragraph quote</p></blockquote>',
      '<blockquote><blockquote>nested quote</blockquote></blockquote>',
      '<blockquote><h2>Heading</h2><p>Content</p></blockquote>',
      '<blockquote><strong>bold</strong> quote</blockquote>',
    ]
    for (const html of cases) {
      const jsResult = jsEngine.htmlToMarkdown(html).markdown.trimEnd()
      const rustResult = rustEngine.htmlToMarkdown(html).markdown.trimEnd()
      expect(rustResult, `Blockquote mismatch for: ${html}`).toBe(jsResult)
    }
  })

  it('code blocks produce identical output', async () => {
    const [jsEngine, rustEngine] = await Promise.all([
      resolveEngine(engines[0].engine),
      resolveEngine(engines[1].engine),
    ])
    const cases = [
      '<pre><code>simple code</code></pre>',
      '<pre><code class="language-js">const x = 1;</code></pre>',
      '<pre><code class="language-python">def foo():\n  pass</code></pre>',
      '<p>Inline <code>code</code> in text.</p>',
      '<pre><code>multi\nline\ncode</code></pre>',
    ]
    for (const html of cases) {
      const jsResult = jsEngine.htmlToMarkdown(html).markdown.trimEnd()
      const rustResult = rustEngine.htmlToMarkdown(html).markdown.trimEnd()
      expect(rustResult, `Code mismatch for: ${html}`).toBe(jsResult)
    }
  })

  it('horizontal rules produce identical output', async () => {
    const [jsEngine, rustEngine] = await Promise.all([
      resolveEngine(engines[0].engine),
      resolveEngine(engines[1].engine),
    ])
    const cases = [
      '<hr />',
      '<p>before</p><hr /><p>after</p>',
      '<hr>',
    ]
    for (const html of cases) {
      const jsResult = jsEngine.htmlToMarkdown(html).markdown.trimEnd()
      const rustResult = rustEngine.htmlToMarkdown(html).markdown.trimEnd()
      expect(rustResult, `HR mismatch for: ${html}`).toBe(jsResult)
    }
  })

  it('definition lists produce identical output', async () => {
    const [jsEngine, rustEngine] = await Promise.all([
      resolveEngine(engines[0].engine),
      resolveEngine(engines[1].engine),
    ])
    const cases = [
      '<dl><dt>Term</dt><dd>Definition</dd></dl>',
      '<dl><dt>First</dt><dd>Def 1</dd><dt>Second</dt><dd>Def 2</dd></dl>',
    ]
    for (const html of cases) {
      const jsResult = jsEngine.htmlToMarkdown(html).markdown.trimEnd()
      const rustResult = rustEngine.htmlToMarkdown(html).markdown.trimEnd()
      expect(rustResult, `DL mismatch for: ${html}`).toBe(jsResult)
    }
  })

  it('details/summary produce identical output', async () => {
    const [jsEngine, rustEngine] = await Promise.all([
      resolveEngine(engines[0].engine),
      resolveEngine(engines[1].engine),
    ])
    const cases = [
      '<details><summary>Click me</summary><p>Hidden content</p></details>',
    ]
    for (const html of cases) {
      const jsResult = jsEngine.htmlToMarkdown(html).markdown.trimEnd()
      const rustResult = rustEngine.htmlToMarkdown(html).markdown.trimEnd()
      expect(rustResult, `Details mismatch for: ${html}`).toBe(jsResult)
    }
  })

  it('figcaption produces identical output', async () => {
    const [jsEngine, rustEngine] = await Promise.all([
      resolveEngine(engines[0].engine),
      resolveEngine(engines[1].engine),
    ])
    const cases = [
      '<figure><img src="/img.png" alt="photo" /><figcaption>Caption text</figcaption></figure>',
      '<figure><figcaption>Just a caption</figcaption></figure>',
    ]
    for (const html of cases) {
      const jsResult = jsEngine.htmlToMarkdown(html).markdown.trimEnd()
      const rustResult = rustEngine.htmlToMarkdown(html).markdown.trimEnd()
      expect(rustResult, `Figcaption mismatch for: ${html}`).toBe(jsResult)
    }
  })

  it('hTML entity decoding in attributes produces identical output', async () => {
    const [jsEngine, rustEngine] = await Promise.all([
      resolveEngine(engines[0].engine),
      resolveEngine(engines[1].engine),
    ])
    const cases = [
      '<a href="https://example.com/path?a=1&amp;b=2">entity link</a>',
      '<a href="https://example.com/search?q=foo&amp;lang=en&amp;page=1">multi entity</a>',
      '<img src="/img.png?w=100&amp;h=200" alt="sized" />',
      '<a href="https://example.com/&#x2F;escaped">hex entity</a>',
    ]
    for (const html of cases) {
      const jsResult = jsEngine.htmlToMarkdown(html).markdown.trimEnd()
      const rustResult = rustEngine.htmlToMarkdown(html).markdown.trimEnd()
      expect(rustResult, `Entity attr mismatch for: ${html}`).toBe(jsResult)
    }
  })

  it('mixed content produces identical output', async () => {
    const [jsEngine, rustEngine] = await Promise.all([
      resolveEngine(engines[0].engine),
      resolveEngine(engines[1].engine),
    ])
    const cases = [
      '<div><h1>Title</h1><p>First paragraph.</p><p>Second paragraph.</p></div>',
      '<article><h2>Post</h2><p>Content with <strong>bold</strong> and <a href="/link">link</a>.</p></article>',
      '<section><h3>Section</h3><ul><li>Item 1</li><li>Item 2</li></ul><p>After list.</p></section>',
      '<div><p>Before</p><blockquote><p>Quote</p></blockquote><p>After</p></div>',
      '<div><p>Text with <br /> line break.</p></div>',
      '<nav><a href="/home">Home</a> <a href="/about">About</a></nav>',
      '<header><h1>Site Name</h1><nav><a href="/">Home</a></nav></header>',
      '<address><p>123 Main St</p></address>',
    ]
    for (const html of cases) {
      const jsResult = jsEngine.htmlToMarkdown(html).markdown.trimEnd()
      const rustResult = rustEngine.htmlToMarkdown(html).markdown.trimEnd()
      expect(rustResult, `Mixed mismatch for: ${html}`).toBe(jsResult)
    }
  })

  it('whitespace handling produces identical output', async () => {
    const [jsEngine, rustEngine] = await Promise.all([
      resolveEngine(engines[0].engine),
      resolveEngine(engines[1].engine),
    ])
    const cases = [
      '<p>  extra   spaces  </p>',
      '<p>\n\n  newlines  \n\n</p>',
      '<p>word1  word2  word3</p>',
      '<span>inline</span> <span>spans</span>',
      '<div><span>text</span><span>adjacent</span></div>',
      '<p><strong>bold</strong> normal <em>italic</em></p>',
    ]
    for (const html of cases) {
      const jsResult = jsEngine.htmlToMarkdown(html).markdown.trimEnd()
      const rustResult = rustEngine.htmlToMarkdown(html).markdown.trimEnd()
      expect(rustResult, `Whitespace mismatch for: ${html}`).toBe(jsResult)
    }
  })

  it('escaping produces identical output', async () => {
    const [jsEngine, rustEngine] = await Promise.all([
      resolveEngine(engines[0].engine),
      resolveEngine(engines[1].engine),
    ])
    const cases = [
      '<table><tr><th>H</th></tr><tr><td>pipe | char</td></tr></table>',
      '<a href="/link">text with [brackets]</a>',
      '<blockquote>text with > char</blockquote>',
    ]
    for (const html of cases) {
      const jsResult = jsEngine.htmlToMarkdown(html).markdown.trimEnd()
      const rustResult = rustEngine.htmlToMarkdown(html).markdown.trimEnd()
      expect(rustResult, `Escape mismatch for: ${html}`).toBe(jsResult)
    }
  })

  it('nested inline formatting produces identical output', async () => {
    const [jsEngine, rustEngine] = await Promise.all([
      resolveEngine(engines[0].engine),
      resolveEngine(engines[1].engine),
    ])
    const cases = [
      '<p><strong><em>bold italic</em></strong></p>',
      '<p><a href="/link"><strong>bold</strong> text</a></p>',
      '<p><code>code</code> then <strong>bold</strong></p>',
      '<p><strong>a</strong><em>b</em><code>c</code></p>',
      '<p>text<sub>1</sub> and text<sup>2</sup></p>',
      '<p><del>deleted <strong>bold</strong></del></p>',
      '<p><mark>marked <a href="/x">link</a></mark></p>',
    ]
    for (const html of cases) {
      const jsResult = jsEngine.htmlToMarkdown(html).markdown.trimEnd()
      const rustResult = rustEngine.htmlToMarkdown(html).markdown.trimEnd()
      expect(rustResult, `Nested inline mismatch for: ${html}`).toBe(jsResult)
    }
  })

  it('complex tables produce identical output', async () => {
    const [jsEngine, rustEngine] = await Promise.all([
      resolveEngine(engines[0].engine),
      resolveEngine(engines[1].engine),
    ])
    const cases = [
      '<table><tr><th>H1</th><th>H2</th><th>H3</th></tr><tr><td>a</td><td>b</td><td>c</td></tr><tr><td>d</td><td>e</td><td>f</td></tr></table>',
      '<table><tr><td><a href="/link">link in cell</a></td><td><strong>bold cell</strong></td></tr></table>',
      '<table><tr><td><em>italic</em> and <code>code</code></td></tr></table>',
      '<table><tr><th>Multi<br>line</th></tr><tr><td>cell</td></tr></table>',
    ]
    for (const html of cases) {
      const jsResult = jsEngine.htmlToMarkdown(html).markdown.trimEnd()
      const rustResult = rustEngine.htmlToMarkdown(html).markdown.trimEnd()
      expect(rustResult, `Complex table mismatch for: ${html}`).toBe(jsResult)
    }
  })

  it('deeply nested structures produce identical output', async () => {
    const [jsEngine, rustEngine] = await Promise.all([
      resolveEngine(engines[0].engine),
      resolveEngine(engines[1].engine),
    ])
    const cases = [
      '<div><div><div><p>deeply nested</p></div></div></div>',
      '<ul><li>a<ul><li>b<ul><li>c</li></ul></li></ul></li></ul>',
      '<blockquote><blockquote><blockquote>triple nested</blockquote></blockquote></blockquote>',
      '<ol><li>first<ol><li>nested<ol><li>deep</li></ol></li></ol></li></ol>',
      '<div><h2>Title</h2><div><ul><li>in div</li></ul></div></div>',
    ]
    for (const html of cases) {
      const jsResult = jsEngine.htmlToMarkdown(html).markdown.trimEnd()
      const rustResult = rustEngine.htmlToMarkdown(html).markdown.trimEnd()
      expect(rustResult, `Nesting mismatch for: ${html}`).toBe(jsResult)
    }
  })

  it('self-closing tags produce identical output', async () => {
    const [jsEngine, rustEngine] = await Promise.all([
      resolveEngine(engines[0].engine),
      resolveEngine(engines[1].engine),
    ])
    const cases = [
      '<p>line one<br>line two</p>',
      '<p>line one<br/>line two</p>',
      '<p>line one<br />line two</p>',
      '<hr><p>after hr</p>',
      '<p>text <wbr>with wbr</p>',
      '<img src="/a.png" alt="image"><p>after</p>',
    ]
    for (const html of cases) {
      const jsResult = jsEngine.htmlToMarkdown(html).markdown.trimEnd()
      const rustResult = rustEngine.htmlToMarkdown(html).markdown.trimEnd()
      expect(rustResult, `Self-closing mismatch for: ${html}`).toBe(jsResult)
    }
  })

  it('span and div wrappers produce identical output', async () => {
    const [jsEngine, rustEngine] = await Promise.all([
      resolveEngine(engines[0].engine),
      resolveEngine(engines[1].engine),
    ])
    const cases = [
      '<span>just text</span>',
      '<div>just text</div>',
      '<span><strong>bold in span</strong></span>',
      '<div><p>paragraph in div</p></div>',
      '<p><span>span </span><span>adjacent</span></p>',
      '<div><span><h2>heading in span in div</h2></span></div>',
    ]
    for (const html of cases) {
      const jsResult = jsEngine.htmlToMarkdown(html).markdown.trimEnd()
      const rustResult = rustEngine.htmlToMarkdown(html).markdown.trimEnd()
      expect(rustResult, `Wrapper mismatch for: ${html}`).toBe(jsResult)
    }
  })

  it('semantic HTML elements produce identical output', async () => {
    const [jsEngine, rustEngine] = await Promise.all([
      resolveEngine(engines[0].engine),
      resolveEngine(engines[1].engine),
    ])
    const cases = [
      '<article><h1>Title</h1><p>Content</p></article>',
      '<section><h2>Section</h2><p>Text</p></section>',
      '<main><p>Main content</p></main>',
      '<aside><p>Side note</p></aside>',
      '<footer><p>Footer text</p></footer>',
      '<header><h1>Header</h1></header>',
      '<nav><a href="/a">A</a> <a href="/b">B</a></nav>',
    ]
    for (const html of cases) {
      const jsResult = jsEngine.htmlToMarkdown(html).markdown.trimEnd()
      const rustResult = rustEngine.htmlToMarkdown(html).markdown.trimEnd()
      expect(rustResult, `Semantic HTML mismatch for: ${html}`).toBe(jsResult)
    }
  })

  it('media elements produce identical output', async () => {
    const [jsEngine, rustEngine] = await Promise.all([
      resolveEngine(engines[0].engine),
      resolveEngine(engines[1].engine),
    ])
    const cases = [
      '<video src="/v.mp4">fallback</video>',
      '<audio src="/a.mp3">fallback</audio>',
      '<picture><source srcset="/img.webp"><img src="/img.png" alt="pic"></picture>',
      '<figure><img src="/fig.png" alt="figure"><figcaption>Caption</figcaption></figure>',
      '<iframe src="/frame.html">no iframes</iframe>',
    ]
    for (const html of cases) {
      const jsResult = jsEngine.htmlToMarkdown(html).markdown.trimEnd()
      const rustResult = rustEngine.htmlToMarkdown(html).markdown.trimEnd()
      expect(rustResult, `Media mismatch for: ${html}`).toBe(jsResult)
    }
  })

  it('text entity decoding in content produces identical output', async () => {
    const [jsEngine, rustEngine] = await Promise.all([
      resolveEngine(engines[0].engine),
      resolveEngine(engines[1].engine),
    ])
    const cases = [
      '<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>',
      '<p>&amp; ampersand</p>',
      '<p>&quot;quoted&quot;</p>',
      '<p>&#169; copyright</p>',
      '<p>&#x2603; snowman</p>',
      '<p>dash &ndash; and &mdash; em</p>',
      '<p>&copy; &reg; &trade;</p>',
    ]
    for (const html of cases) {
      const jsResult = jsEngine.htmlToMarkdown(html).markdown.trimEnd()
      const rustResult = rustEngine.htmlToMarkdown(html).markdown.trimEnd()
      expect(rustResult, `Entity content mismatch for: ${html}`).toBe(jsResult)
    }
  })

  it('malformed HTML produces identical output', async () => {
    const [jsEngine, rustEngine] = await Promise.all([
      resolveEngine(engines[0].engine),
      resolveEngine(engines[1].engine),
    ])
    const cases = [
      '<p>unclosed paragraph',
      '<div><p>nested unclosed<div>another div</div>',
      '<p>text <strong>bold unclosed</p>',
      '<ul><li>item 1<li>item 2<li>item 3</ul>',
      '<br><br><br>',
      '<p></p><p></p>',
    ]
    for (const html of cases) {
      const jsResult = jsEngine.htmlToMarkdown(html).markdown.trimEnd()
      const rustResult = rustEngine.htmlToMarkdown(html).markdown.trimEnd()
      expect(rustResult, `Malformed mismatch for: ${html}`).toBe(jsResult)
    }
  })

  it('script and style exclusion produces identical output', async () => {
    const [jsEngine, rustEngine] = await Promise.all([
      resolveEngine(engines[0].engine),
      resolveEngine(engines[1].engine),
    ])
    const cases = [
      '<p>before</p><script>alert(1)</script><p>after</p>',
      '<p>before</p><style>body { color: red }</style><p>after</p>',
      '<p>before</p><noscript>no js</noscript><p>after</p>',
    ]
    for (const html of cases) {
      const jsResult = jsEngine.htmlToMarkdown(html).markdown.trimEnd()
      const rustResult = rustEngine.htmlToMarkdown(html).markdown.trimEnd()
      expect(rustResult, `Script/style mismatch for: ${html}`).toBe(jsResult)
    }
  })

  it('origin resolution produces identical output', async () => {
    const [jsEngine, rustEngine] = await Promise.all([
      resolveEngine(engines[0].engine),
      resolveEngine(engines[1].engine),
    ])
    const options = { origin: 'https://example.com' }
    const cases = [
      '<a href="/path">relative link</a>',
      '<img src="/img.png" alt="relative image" />',
      '<a href="https://other.com/page">absolute link</a>',
      '<a href="#anchor">anchor only</a>',
      '<a href="//cdn.example.com/file">protocol-relative</a>',
    ]
    for (const html of cases) {
      const jsResult = jsEngine.htmlToMarkdown(html, options).markdown.trimEnd()
      const rustResult = rustEngine.htmlToMarkdown(html, options).markdown.trimEnd()
      expect(rustResult, `Origin mismatch for: ${html}`).toBe(jsResult)
    }
  })

  it('nested list with empty sublists produces identical output', async () => {
    const [jsEngine, rustEngine] = await Promise.all([
      resolveEngine(engines[0].engine),
      resolveEngine(engines[1].engine),
    ])
    const cases = [
      // Wikipedia TOC pattern: li > ul (empty)
      '<ul><li>Parent<ul></ul></li><li>Sibling</li></ul>',
      // li > a + button + ul > li
      '<ul><li><a href="#a">Item 1</a><ul><li><a href="#b">Sub 1</a><ul></ul></li><li><a href="#c">Sub 2</a><ul></ul></li></ul></li><li><a href="#d">Item 2</a></li></ul>',
      // Nested non-empty sublists inside li with trailing empty ul
      '<ul><li>Top<ul><li>Mid<ul></ul></li></ul></li></ul>',
      // Wikipedia TOC exact pattern
      '<ul><li><a href="#a"><div><span>1</span><span>Hierarchy</span></div></a><button>Toggle</button><ul><li><a href="#b"><div><span>1.1</span><span>Zoology</span></div></a><ul></ul></li><li><a href="#c"><div><span>1.2</span><span>Botany</span></div></a><ul></ul></li></ul></li><li><a href="#d"><div><span>2</span><span>History</span></div></a></li></ul>',
    ]
    for (const html of cases) {
      const jsResult = jsEngine.htmlToMarkdown(html).markdown.trimEnd()
      const rustResult = rustEngine.htmlToMarkdown(html).markdown.trimEnd()
      expect(rustResult, `Nested empty list mismatch for: ${html}`).toBe(jsResult)
    }
  })

  it('link text with special structures produces identical output', async () => {
    const [jsEngine, rustEngine] = await Promise.all([
      resolveEngine(engines[0].engine),
      resolveEngine(engines[1].engine),
    ])
    const cases = [
      // ISBN-style: link with title attribute
      '<a href="/wiki/Special:BookSources/978-0-030-27044-4" title="Special:BookSources/978-0-030-27044-4">978-0-030-27044-4</a>',
      // Link with title
      '<a href="/page" title="Page Title">Link Text</a>',
      // Nested spans inside link
      '<a href="#section"><div><span>1</span><span>Section Name</span></div></a>',
    ]
    for (const html of cases) {
      const jsResult = jsEngine.htmlToMarkdown(html).markdown.trimEnd()
      const rustResult = rustEngine.htmlToMarkdown(html).markdown.trimEnd()
      expect(rustResult, `Link structure mismatch for: ${html}`).toBe(jsResult)
    }
  })

  it('tag override aliases produce identical output', async () => {
    const [jsEngine, rustEngine] = await Promise.all([
      resolveEngine(engines[0].engine),
      resolveEngine(engines[1].engine),
    ])
    const options = {
      plugins: {
        tagOverrides: {
          'x-heading': 'h2',
          'x-bold': 'strong',
        },
      },
    }
    const cases = [
      '<x-heading>Custom Heading</x-heading>',
      '<p><x-bold>Custom Bold</x-bold></p>',
      '<x-heading>Title</x-heading><p>Content</p>',
    ]
    for (const html of cases) {
      const jsResult = jsEngine.htmlToMarkdown(html, options).markdown.trimEnd()
      const rustResult = rustEngine.htmlToMarkdown(html, options).markdown.trimEnd()
      expect(rustResult, `Tag override mismatch for: ${html}`).toBe(jsResult)
    }
  })
})
