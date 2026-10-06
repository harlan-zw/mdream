import type { MarkdownChunk, SplitterOptions } from '../../src/types'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { clean } from '../../src/clean'
import { htmlToMarkdown } from '../../src/index'
import { withMinimalPreset } from '../../src/preset/minimal'
import { htmlToMarkdownSplitChunks, htmlToMarkdownSplitChunksStream } from '../../src/splitter'
import { CONVERSION_CORPUS } from '../fixtures/conversion-corpus'

const LEADING_BLANK_LINE_RE = /^[ \t]*\n/
const TRAILING_BLANK_LINE_RE = /\n[ \t]*$/
const LEADING_BLANK_LINES_RE = /^(?:[ \t]*\n)+/

function isWhitespace(code: number): boolean {
  return code === 32 || (code >= 9 && code <= 13)
}

/**
 * The first break of the chunk contract, or undefined. Each chunk is the
 * slice of the converted Markdown that starts on line `loc.from` and ends on
 * line `loc.to`, with no blank first or last line. A chunk starts at the next
 * content after the previous chunk, or inside it as overlap, and ends past it.
 * So the chunks hold every non-whitespace character in order. Repeated text
 * can match in several places, so this searches for one placement that fits.
 */
function chunkContractViolation(markdown: string, chunks: MarkdownChunk[]): string | undefined {
  for (const [index, { content }] of chunks.entries()) {
    if (!content.trim())
      return `chunk ${index} is empty`
    if (LEADING_BLANK_LINE_RE.test(content) || TRAILING_BLANK_LINE_RE.test(content))
      return `chunk ${index} has a blank edge line: ${JSON.stringify(content)}`
  }
  const lineStarts = [0]
  for (let index = 0; index < markdown.length; index++) {
    if (markdown.charCodeAt(index) === 10)
      lineStarts.push(index + 1)
  }
  const lineOf = (offset: number): number => {
    let lower = 0
    let upper = lineStarts.length
    while (lower < upper) {
      const middle = (lower + upper) >>> 1
      if (lineStarts[middle]! <= offset)
        lower = middle + 1
      else
        upper = middle
    }
    return lower
  }
  // Where a chunk can start: at the next content, keeping the indent of a
  // line it opens, or as overlap inside the previous chunk.
  const starts = (content: string, previousStart: number, covered: number): number[] => {
    const found: number[] = []
    for (let overlap = markdown.indexOf(content, previousStart + 1); overlap !== -1 && overlap < covered; overlap = markdown.indexOf(content, overlap + 1)) {
      if (overlap + content.length > covered)
        found.push(overlap)
    }
    let next = covered
    while (next < markdown.length && isWhitespace(markdown.charCodeAt(next)))
      next++
    const lineStart = markdown.lastIndexOf('\n', next - 1) + 1
    if (lineStart >= covered && markdown.startsWith(content, lineStart))
      found.push(lineStart)
    else if (markdown.startsWith(content, next))
      found.push(next)
    return found
  }
  const failed = new Set<string>()
  let furthest = 0
  const place = (index: number, previousStart: number, covered: number): boolean => {
    furthest = Math.max(furthest, index)
    if (index === chunks.length)
      return !markdown.slice(covered).trim()
    const key = `${index}:${previousStart}`
    if (failed.has(key))
      return false
    const { content, metadata } = chunks[index]!
    for (const start of starts(content, previousStart, covered)) {
      if (lineOf(start) === metadata.loc!.lines.from && lineOf(start + content.length - 1) === metadata.loc!.lines.to
        && place(index + 1, start, start + content.length)) {
        return true
      }
    }
    failed.add(key)
    return false
  }
  if (place(0, -1, 0))
    return undefined
  return furthest === chunks.length
    ? 'the chunks miss content at the end'
    : `chunk ${furthest} is not the next Markdown on lines ${JSON.stringify(chunks[furthest]!.metadata.loc)}: ${JSON.stringify(chunks[furthest]!.content)}`
}

function splitViolation(html: string, options: () => SplitterOptions, split: SplitterOptions = {}): string | undefined {
  const chunks = htmlToMarkdownSplitChunks(html, { ...options(), stripHeaders: false, ...split })
  return chunkContractViolation(htmlToMarkdown(html, options()), chunks)
}

const SPLIT_OPTION_SETS: { name: string, options: () => SplitterOptions }[] = [
  { name: 'no options', options: () => ({}) },
  { name: 'fragment cleanup', options: () => ({ clean: clean({ fragments: true }) }) },
  { name: 'all cleanup', options: () => ({ clean: clean() }) },
  { name: 'minimal preset', options: () => withMinimalPreset({ origin: 'https://example.com' }) },
]

const numbered = (count: number, word: string) => Array.from({ length: count }, (_, index) => `${word}${index}`).join(' ')
const QUOTE_HTML = `<blockquote>${Array.from({ length: 12 }, (_, index) => `<p>${numbered(30, `q${index}w`)}</p>`).join('')}</blockquote><p>tail</p>`

const SPLIT_INPUTS = [
  ...CONVERSION_CORPUS,
  QUOTE_HTML,
  `<ul>${Array.from({ length: 8 }, (_, index) => `<li><p>${numbered(20, `l${index}w`)}</p><ul><li>${numbered(10, `n${index}w`)}</li></ul></li>`).join('')}</ul>`,
  `<h2>One</h2><p>${numbered(80, 'a')}</p><h3>Two</h3><pre class="language-ts">${numbered(60, 'c').replaceAll(' ', '\n')}</pre><hr><p>${numbered(40, 'b')}</p><h2>Three</h2><p>end</p>`,
  `<p>${numbered(40, 'w')}</p><p>${'x'.repeat(300)}</p><p>${numbered(40, 'v')}</p>`,
  `<p><a href="#missing">intro</a> ${numbered(60, 'f')}</p><h2>Missing</h2><blockquote><p><a href="#missing">back</a> ${numbered(60, 'g')}</p></blockquote>`,
]

const FIXTURE_NAMES = ['github-markdown-complete.html', 'nuxt-example.html', 'wikipedia-small.html']

describe('splitter chunk contract', () => {
  for (const set of SPLIT_OPTION_SETS) {
    it(`holds for every split input with ${set.name}`, () => {
      for (const html of SPLIT_INPUTS) {
        for (const split of [{ chunkSize: 30, chunkOverlap: 0 }, { chunkSize: 30, chunkOverlap: 10 }, { chunkSize: 200, chunkOverlap: 50 }])
          expect(splitViolation(html, set.options, split), `${JSON.stringify(html)} ${JSON.stringify(split)}`).toBeUndefined()
      }
    })

    it.each(FIXTURE_NAMES)(`holds for %s with ${set.name}`, (name) => {
      const html = readFileSync(new URL(`../../../mdream/test/fixtures/${name}`, import.meta.url), 'utf8')
      for (const split of [{}, { chunkSize: 300, chunkOverlap: 0 }])
        expect(splitViolation(html, set.options, split), JSON.stringify(split)).toBeUndefined()
    })
  }

  it('keeps the quote prefix on every line of a long blockquote', () => {
    for (const chunkOverlap of [0, 200]) {
      expect(splitViolation(QUOTE_HTML, () => ({}), { chunkOverlap })).toBeUndefined()
      const chunks = htmlToMarkdownSplitChunks(QUOTE_HTML, { chunkOverlap })
      expect(chunks.length).toBeGreaterThan(2)
      // Overlap starts at a word, so only its first line may lack the prefix.
      for (const chunk of chunks) {
        const lines = chunk.content.split('\n').slice(chunkOverlap ? 1 : 0)
        expect(lines.filter(line => line && line !== 'tail').every(line => line.startsWith('>'))).toBe(true)
      }
    }
  })

  it('splits an oversized word the same way with fragment cleanup', () => {
    const html = `<p>${'word '.repeat(150)}</p><p>${'x'.repeat(1500)}</p>`
    const plain = htmlToMarkdownSplitChunks(html)
    expect(htmlToMarkdownSplitChunks(html, { clean: clean({ fragments: true }) })).toEqual(plain)
    expect(plain.length).toBeLessThanOrEqual(3)
  })

  it.each([
    ['no options', {}],
    ['minimal preset', withMinimalPreset()],
  ])('yields no blank edge lines with %s', (_name, options) => {
    const html = `<main><p>intro</p><h2>One</h2><p>${numbered(80, 'a')}</p><hr><p>${numbered(80, 'b')}</p><h2>Two</h2><p>end</p></main>`
    for (const stripHeaders of [false, true]) {
      for (const chunkOverlap of [0, 20]) {
        const chunks = htmlToMarkdownSplitChunks(html, { ...options, chunkSize: 100, chunkOverlap, stripHeaders })
        expect(chunks.length).toBeGreaterThan(3)
        for (const chunk of chunks)
          expect(chunk.content).toBe(chunk.content.replace(LEADING_BLANK_LINES_RE, '').trimEnd())
      }
    }
  })
})

describe('link cleanup in the splitter', () => {
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
    const markdown = htmlToMarkdown(html, { clean: options.clean })
    for (const chunkSize of [8, 20, 40]) {
      expect(chunkContractViolation(markdown, htmlToMarkdownSplitChunks(html, { ...options, chunkSize })), `chunk size ${chunkSize}`).toBeUndefined()
      const lines = htmlToMarkdownSplitChunks(html, { ...options, chunkSize, returnEachLine: true })
      expect(lines.map(chunk => chunk.content).join('').replace(/\s+/g, '')).toBe(markdown.replace(/\s+/g, ''))
    }
  })

  it.each([
    ['Title', 'Title'],
    ['Title #', 'Title #'],
    ['Title <b>bold</b>', 'Title bold'],
  ])('holds rewritten heading links: %s', (title, expectedHeader) => {
    const html = `<h2><a href="#title">${title}</a></h2><p>after</p><h2>Next</h2><p>tail</p>`
    const options = { clean: clean({ selfLinkHeadings: true }), chunkOverlap: 0, stripHeaders: false }
    const expected = htmlToMarkdown(html, { clean: options.clean }).replace(/\s+/g, '')
    for (const chunkSize of [4, 8, 20]) {
      const chunks = htmlToMarkdownSplitChunks(html, { ...options, chunkSize })
      expect(chunks.map(chunk => chunk.content).join('').replace(/\s+/g, '')).toBe(expected)
      expect(chunks.find(chunk => chunk.content.includes('after'))?.metadata.headers?.h2).toBe(expectedHeader)
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

  it.each([
    `<p>${'prefix '.repeat(7)}</p><pre class="language-js">body</pre><p>tail</p>`,
    '<p>prefix prefix</p><blockquote><pre class="language-js">body</pre></blockquote><p>tail</p>',
  ])('keeps pending code language when a stable prefix flushes first: %s', (html) => {
    const chunks = htmlToMarkdownSplitChunks(html, {
      clean: clean({ redundantLinks: true }),
      chunkSize: 7,
      chunkOverlap: 0,
      stripHeaders: false,
    })
    expect(chunks.filter(chunk => !chunk.content.includes('```js')).every(chunk => chunk.metadata.code === undefined)).toBe(true)
    expect(chunks.find(chunk => chunk.content.includes('body'))?.metadata.code).toBe('js')
  })

  it.each(['root tail', '<b>closed</b> tail', '<b>unclosed'])('finalizes parser output: %s', (html) => {
    const chunks = htmlToMarkdownSplitChunks(html, { chunkSize: 100, chunkOverlap: 0, stripHeaders: false })
    expect(chunks.map(chunk => chunk.content).join('')).toBe(htmlToMarkdown(html))
  })

  it('yields the cleaned link as the first chunk', () => {
    const html = `<a href="${url}">${url}</a><hr><p>${'later '.repeat(30)}</p>`
    const chunks = htmlToMarkdownSplitChunksStream(html, { clean: clean({ redundantLinks: true }), chunkSize: 20, chunkOverlap: 0, stripHeaders: false })
    expect(chunks.next().value?.content).toBe(url)
    expect([...chunks].map(chunk => chunk.content).join(' ')).toContain('later')
  })
})

describe('splitter cleanup boundaries and options', () => {
  it('retains section ownership when a quote prefixes its completed lines', () => {
    const html = '<blockquote><h2>One</h2><p>x</p><h2>Two</h2><p>y</p></blockquote><p>end</p>'
    const chunks = htmlToMarkdownSplitChunks(html, { clean: clean({ fragments: true }), chunkSize: 100, chunkOverlap: 0, stripHeaders: false })
    expect(chunks).toHaveLength(2)
    expect(chunks[0]?.content).toContain('> x')
    expect(chunks[0]?.metadata.headers?.h2).toBe('One')
    expect(chunks[1]?.content).toMatch(/^> ## Two/)
    expect(chunks[1]?.metadata.headers?.h2).toBe('Two')
    expect(chunkContractViolation(htmlToMarkdown(html, { clean: clean({ fragments: true }) }), chunks)).toBeUndefined()
  })

  it.each([
    '<blockquote><blockquote><h2>One</h2><p>x</p><h2>Two</h2><p>y</p></blockquote></blockquote>',
    '<ul><li><blockquote><h2>One</h2><p>x</p><h2>Two</h2><p>y</p></blockquote></li></ul>',
    '<a href="#missing"><h2>One</h2><p>x</p><h2>Two</h2><p>y</p></a>',
    '<figcaption><h2>One</h2><p>x</p><h2>Two</h2><p>y</p></figcaption>',
  ])('retains section ownership across nested writer rewrites: %s', (html) => {
    const options = { clean: clean({ fragments: true, selfLinkHeadings: true }), chunkSize: 1000, chunkOverlap: 0, stripHeaders: false }
    const chunks = htmlToMarkdownSplitChunks(html, options)
    expect(chunks.find(chunk => chunk.content.includes('x'))?.metadata.headers?.h2).toBe('One')
    expect(chunks.find(chunk => chunk.content.includes('y'))?.metadata.headers?.h2).toBe('Two')
    expect(chunkContractViolation(htmlToMarkdown(html, { clean: options.clean }), chunks)).toBeUndefined()
  })

  it('keeps an HR boundary before the quote writer prefixes its lines', () => {
    const html = '<blockquote><h2>One</h2><p>x</p><hr><p>y</p></blockquote><h2>Two</h2><p>z</p>'
    const options = { clean: clean({ fragments: true }), chunkSize: 1000, chunkOverlap: 0, stripHeaders: false }
    const chunks = htmlToMarkdownSplitChunks(html, options)
    const before = chunks.findIndex(chunk => chunk.content.includes('x'))
    const after = chunks.findIndex(chunk => chunk.content.includes('y'))
    expect(after).toBeGreaterThan(before)
    expect(chunks[before]?.metadata.headers?.h2).toBe('One')
    expect(chunks[after]?.metadata.headers?.h2).toBe('One')
    expect(chunks.find(chunk => chunk.content.includes('z'))?.metadata.headers?.h2).toBe('Two')
    expect(chunkContractViolation(htmlToMarkdown(html, { clean: options.clean }), chunks)).toBeUndefined()
  })

  it.each([true, { fragments: true }])('rejects unsupported cleanup configuration: %j', (invalidClean) => {
    const options = { clean: invalidClean as any, chunkSize: 100, chunkOverlap: 0 }
    expect(() => htmlToMarkdown('<p>x</p>', { clean: options.clean })).toThrow('@mdream/js/clean')
    expect(() => htmlToMarkdownSplitChunks('<p>x</p>', options)).toThrow('@mdream/js/clean')
    expect(() => htmlToMarkdownSplitChunksStream('<p>x</p>', options).next()).toThrow('@mdream/js/clean')
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
      const markdown = htmlToMarkdown(html, { clean: options.clean })
      const fence = markdown.slice(markdown.indexOf(`${marker}js`), markdown.lastIndexOf(marker) + marker.length)
      for (const chunkSize of [10, 20, 40]) {
        for (const chunkOverlap of [0, 5]) {
          const chunks = htmlToMarkdownSplitChunks(html, { ...options, chunkSize, chunkOverlap })
          expect(chunks.find(chunk => chunk.content.includes(fence))?.metadata.code).toBe('js')
          expect(chunkContractViolation(markdown, chunks)).toBeUndefined()
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
    expect(chunkContractViolation(htmlToMarkdown(html, { clean: options.clean }), chunks)).toBeUndefined()
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
