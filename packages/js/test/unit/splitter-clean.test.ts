import { describe, expect, it } from 'vitest'
import { clean } from '../../src/clean'
import { htmlToMarkdown } from '../../src/index'
import { htmlToMarkdownSplitChunks, htmlToMarkdownSplitChunksStream } from '../../src/splitter'

describe('incremental link cleanup in the splitter', () => {
  const url = `https://example.com/${'a'.repeat(60)}`

  it.each([
    `<a href="${url}">https://<span>example.com/</span>${'a'.repeat(60)}</a>!`,
    `<blockquote><a href="${url}">${url}</a> tail</blockquote><p>end</p>`,
    `<blockquote><blockquote><a href="${url}">${url}</a> tail</blockquote></blockquote>`,
    `<b><a href="${url}">${url}</a></b>!`,
    `<i><a href="${url}">${url}</a></i>!`,
    `<ul><li><a href="${url}">${url}</a> tail</li></ul>`,
    `<figure><figcaption><a href="${url}">${url}</a> tail</figcaption></figure>`,
    `<code><a href="${url}">${url}</a> tail</code>`,
  ])('holds rewritten links and their enclosing writers: %s', (html) => {
    const options = { clean: clean({ redundantLinks: true }), chunkOverlap: 0, stripHeaders: false }
    const expected = htmlToMarkdown(html, options).replace(/\s+/g, '')
    for (const chunkSize of [8, 20, 40]) {
      for (const returnEachLine of [false, true]) {
        const chunks = htmlToMarkdownSplitChunks(html, { ...options, chunkSize, returnEachLine })
        const actual = chunks.map(chunk => chunk.content).join('')
        expect(actual.replace(/\s+/g, '')).toBe(expected)
        if (!html.includes('<blockquote>') && !html.includes('<ul>') && !html.includes('<figure>'))
          expect(actual).toBe(htmlToMarkdown(html, options))
      }
    }
  })

  it.each(['Title', 'Title #', 'Title <b>bold</b>'])('holds rewritten heading links: %s', (title) => {
    const html = `<h2><a href="#title">${title}</a></h2><p>after</p><h2>Next</h2><p>tail</p>`
    const options = { clean: clean({ selfLinkHeadings: true }), chunkOverlap: 0, stripHeaders: false }
    const expected = htmlToMarkdown(html, options).replace(/\s+/g, '')
    for (const chunkSize of [4, 8, 20]) {
      const chunks = htmlToMarkdownSplitChunks(html, { ...options, chunkSize })
      expect(chunks.map(chunk => chunk.content).join('').replace(/\s+/g, '')).toBe(expected)
      expect(chunks.find(chunk => chunk.content.includes('after'))?.metadata.headers?.h2).toBe(title.replace(/<[^>]*>/g, ''))
      expect(chunks.find(chunk => chunk.content.includes('tail'))?.metadata.headers?.h2).toBe('Next')
    }
  })

  it('keeps code language and heading provenance after a rewritten link', () => {
    const html = '<h2>First</h2><p><a href="https://example.com">https://example.com</a></p><pre><code class="language-ts">const n = 1</code></pre><h2>Next</h2><p>tail</p>'
    const chunks = htmlToMarkdownSplitChunks(html, {
      clean: clean({ redundantLinks: true }),
      chunkSize: 20,
      chunkOverlap: 0,
      stripHeaders: false,
    })
    const code = chunks.find(chunk => chunk.content.includes('const n'))
    expect(code?.metadata.code).toBe('ts')
    expect(code?.metadata.headers?.h2).toBe('First')
    expect(chunks.find(chunk => chunk.content.includes('tail'))?.metadata.headers?.h2).toBe('Next')
  })

  it('keeps pending code language when a stable prefix flushes first', () => {
    const html = `<p>${'prefix '.repeat(7)}</p><pre class="language-js">body</pre><p>tail</p>`
    const chunks = htmlToMarkdownSplitChunks(html, {
      clean: clean({ redundantLinks: true }),
      chunkSize: 20,
      chunkOverlap: 0,
      stripHeaders: false,
    })
    expect(chunks.filter(chunk => chunk.content.includes('prefix')).every(chunk => chunk.metadata.code === undefined)).toBe(true)
    expect(chunks.find(chunk => chunk.content.includes('body'))?.metadata.code).toBe('js')
  })

  it.each(['root tail', '<b>closed</b> tail', '<b>unclosed'])('finalizes parser output: %s', (html) => {
    const chunks = htmlToMarkdownSplitChunks(html, { chunkSize: 100, chunkOverlap: 0, stripHeaders: false })
    expect(chunks.map(chunk => chunk.content).join('')).toBe(htmlToMarkdown(html))
  })

  it('releases a cleaned link before the rest of the document', () => {
    const html = `<a href="${url}">${url}</a><hr><p>${'later '.repeat(30)}</p>`
    const chunks = htmlToMarkdownSplitChunksStream(html, { clean: clean({ redundantLinks: true }), chunkSize: 20, chunkOverlap: 0, stripHeaders: false })
    expect(chunks.next().value?.content).toBe(url)
    expect([...chunks].map(chunk => chunk.content).join(' ')).toContain('later')
  })
})

describe('fragment cleanup in the splitter', () => {
  it.each([
    ['list', '<ul><li>', '</li></ul>'],
    ['ordered', '<ol start="10"><li>', '</li></ol>'],
    ['nested list', '<ul><li><ol><li>', '</li></ol></li></ul>'],
    ['quoted list', '<blockquote><ul><li>', '</li></ul></blockquote>'],
    ['list quote', '<ul><li><blockquote>', '</blockquote></li></ul>'],
  ])('keeps complete fences inside a %s', (_name, start, end) => {
    for (const ticks of [3, 4, 5]) {
      const marker = '`'.repeat(ticks + 1)
      const html = `<p><a href="#missing">intro</a></p>${start}<pre class="language-js">aaa\n${'`'.repeat(ticks)}\nbbb\nccc\nddd\neee</pre>${end}<p>tail</p>`
      const options = { clean: clean({ fragments: true }), stripHeaders: false }
      const markdown = htmlToMarkdown(html, options)
      const fence = markdown.slice(markdown.indexOf(`${marker}js`), markdown.lastIndexOf(marker) + marker.length)
      for (const chunkSize of [10, 20, 40]) {
        for (const chunkOverlap of [0, 5]) {
          const chunks = htmlToMarkdownSplitChunks(html, { ...options, chunkSize, chunkOverlap })
          expect(chunks.find(chunk => chunk.content.includes(fence))?.metadata.code).toBe('js')
          if (!chunkOverlap)
            expect(chunks.map(chunk => chunk.content).join('')).toBe(markdown)
        }
      }
    }
  })

  it.each([
    ['js', 'aaa\n```\nbbb\nccc\nddd\neee', '````js\naaa\n```\nbbb\nccc\nddd\neee\n````'],
    ['js', 'aaa\n~~~\nbbb\nccc\nddd\neee', '```js\naaa\n~~~\nbbb\nccc\nddd\neee\n```'],
    ['js', 'aaa\n`````\nbbb\nccc\nddd\neee', '``````js\naaa\n`````\nbbb\nccc\nddd\neee\n``````'],
    ['js', 'aaa\n> ```\nbbb\nccc\nddd\neee', '```js\naaa\n> ```\nbbb\nccc\nddd\neee\n```'],
    ['js', 'aaa\n    ```\nbbb\nccc\nddd\neee', '```js\naaa\n    ```\nbbb\nccc\nddd\neee\n```'],
  ])('keeps the %s fence complete around %s', (language, code, fence) => {
    const html = `<p><a href="#missing">intro</a></p><pre class="language-${language}">${code}</pre><p>tail</p>`
    for (const chunkOverlap of [0, 5]) {
      const chunks = htmlToMarkdownSplitChunks(html, { clean: clean({ fragments: true }), chunkSize: 20, chunkOverlap, stripHeaders: false })
      expect(chunks.find(chunk => chunk.content.includes(fence))?.metadata.code).toBe(language)
    }
  })
  it('bounds chunks after an unresolved link', () => {
    const html = `<p><a href="#missing">missing</a></p>${'<p>many ordinary words in paragraph</p>'.repeat(100)}`
    const options = { clean: clean({ fragments: true }), chunkSize: 100, chunkOverlap: 0, stripHeaders: false }
    const chunks = htmlToMarkdownSplitChunks(html, options)
    expect(Math.max(...chunks.map(chunk => chunk.content.length))).toBeLessThanOrEqual(100)
    expect(chunks.map(chunk => chunk.content).join('')).toBe(htmlToMarkdown(html, options))
  })

  it('keeps header provenance when a later heading resolves a link', () => {
    const html = '<p>before</p><p><a href="#x">link</a></p><h2>Other</h2><p>other content</p><h2>X</h2><p>tail</p>'
    const chunks = htmlToMarkdownSplitChunks(html, { clean: clean({ fragments: true }), chunkSize: 100, chunkOverlap: 0, stripHeaders: false })
    expect(chunks.find(chunk => chunk.content.includes('other content'))?.metadata.headers?.h2).toBe('Other')
    expect(chunks.find(chunk => chunk.content.includes('tail'))?.metadata.headers?.h2).toBe('X')
  })

  it('attaches code language to the chunk that contains the fence', () => {
    const html = `<p><a href="#missing">intro</a> ${'ordinary text '.repeat(20)}</p><pre class="language-ts">const x = 1</pre><p>tail</p>`
    const chunks = htmlToMarkdownSplitChunks(html, { clean: clean({ fragments: true }), chunkSize: 100, chunkOverlap: 0, stripHeaders: false })
    expect(chunks.find(chunk => chunk.content.includes('```ts'))?.metadata.code).toBe('ts')
    expect(chunks.find(chunk => chunk.content.includes('intro'))?.metadata.code).toBeUndefined()
  })
})
