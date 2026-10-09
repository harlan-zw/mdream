import { createHash } from 'node:crypto'
import { htmlToMarkdown, streamHtmlToMarkdown } from '@mdream/js'
import { clean } from '@mdream/js/clean'
import { describe, expect, it } from 'vitest'
import { countJsStream, EXCLUDED_BODY_SIZES, longLineFixture, observeJsStream, PARAGRAPH, streamFixture, unicodeHtml } from './perf-fixtures.ts'
import { workloads } from './rust-perf/fixtures.ts'

const clock = { wall: () => 0, cpu: () => 0 }
const digest = (value: string) => createHash('sha256').update(value).digest()

describe('performance fixtures through public conversion', () => {
  it('cleans the large-query scaling workloads', () => {
    const cases = workloads(process.cwd()).filter(fixture => fixture.scaling?.group.startsWith('tracking-'))
    expect(cases).toHaveLength(6)
    for (const fixture of cases) {
      if (fixture.operation !== 'convert' || !fixture.scaling)
        throw new Error('Tracking workloads must convert a scaling fixture.')
      const fields = fixture.scaling.size * 4096
      const query = fixture.scaling.group === 'tracking-alternating'
        ? 'id=1&'.repeat(fields)
        : `id=${'x'.repeat(fields * 8)}`
      expect(fixture.options).toBe('clean')
      expect(fixture.format).toBe('markdown')
      expect(htmlToMarkdown(fixture.html, {
        origin: 'https://example.com/docs/page',
        clean: clean({ urls: true, redundantLinks: true }),
      }))
        .toBe(`[Guide](https://example.com/guide?${query}#part)`)
      expect(fixture.inputBytes).toBe(Buffer.byteLength(fixture.html))
    }
  })

  it('converts mixed Unicode spans without changing code points', () => {
    expect(htmlToMarkdown(unicodeHtml(3))).toBe('東京日本語🙂éλληνικά'.repeat(3))
  })

  it.each(['style', 'comment', 'cdata'] as const)('drops an open %s body across input chunks', async (kind) => {
    for (const bodyBytes of EXCLUDED_BODY_SIZES) {
      const fixture = streamFixture(kind, bodyBytes)
      const result = await observeJsStream(streamHtmlToMarkdown, fixture.chunks(), { clock })
      expect(result.digest).toEqual(digest('after'))
      expect(result.length).toBe(5)
    }
  })

  it('keeps quoted paragraphs and trailing content', async () => {
    const fixture = streamFixture('quote', PARAGRAPH.length)
    const result = await observeJsStream(streamHtmlToMarkdown, fixture.chunks(), { clock })
    const expected = '> Ordinary words in a small paragraph.\n\nafter'
    expect(result.digest).toEqual(digest(expected))
    expect(result.length).toBe(expected.length)
  })

  it.each([true, false])('keeps a long line split across span chunks (quoted: %s)', async (quoted) => {
    const fixture = longLineFixture(4 * 1024, quoted)
    const result = await observeJsStream(streamHtmlToMarkdown, fixture.chunks(), { clock })
    const expected = `${quoted ? '> ' : ''}${'x'.repeat(fixture.bodyBytes)}`
    expect(result.digest).toEqual(digest(expected))
    expect(result.length).toBe(expected.length)
    expect(result.inputChunks).toBe(6)
    expect(await countJsStream(streamHtmlToMarkdown, fixture.chunks(), { clock })).toBe(expected.length)
  })

  it('records the input chunk that first yields content', async () => {
    async function* convert(source: ReadableStream<string>) {
      const reader = source.getReader()
      try {
        while (true) {
          const part = await reader.read()
          if (part.done)
            return
          if (part.value === 'emit')
            yield 'result'
        }
      }
      finally {
        reader.releaseLock()
      }
    }
    const beforeInput: number[] = []
    const result = await observeJsStream(convert, ['wait', 'emit', 'tail'], {
      clock,
      beforeInput: count => beforeInput.push(count),
    })
    expect(result.digest).toEqual(digest('result'))
    expect(result.firstOutput).toEqual({ _tag: 'Emitted', inputChunks: 2, wallMs: 0, cpuMs: 0 })
    expect(beforeInput).toEqual([0, 1, 2, 3])
  })

  it('keeps a missing first output distinct from an empty emitted chunk', async () => {
    async function* convert() {
      yield ''
    }
    const result = await observeJsStream(convert, [], { clock })
    expect(result.digest).toEqual(digest(''))
    expect(result.firstOutput).toEqual({ _tag: 'None' })
  })
})
