import { describe, expect, it } from 'vitest'
import { clean } from '../../src/clean'
import { htmlToMarkdown } from '../../src/index'
import { htmlToMarkdownSplitChunks } from '../../src/splitter'

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
