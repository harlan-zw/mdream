import type { MdreamOptions } from '../../src/types'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { clean } from '../../src/clean'
import { htmlToSafeHtml, streamHtmlToSafeHtml } from '../../src/html'
import { htmlToMarkdown, streamHtmlToMarkdown } from '../../src/index'
import { extractionPlugin, frontmatterPlugin } from '../../src/plugins'
import { withMinimalPreset } from '../../src/preset/minimal'
import { htmlToText, streamHtmlToText } from '../../src/text'
import { CONVERSION_CORPUS } from '../fixtures/conversion-corpus'

// Rules that hold for every input, so a new bug fails here even when no
// example test covers its input. Add new bug inputs to CONVERSION_CORPUS.

type Convert = (html: string, options?: MdreamOptions) => string
type Stream = (stream: ReadableStream<Uint8Array | string>, options?: MdreamOptions) => AsyncIterable<string>

const FORMATS: { name: string, convert: Convert, stream: Stream }[] = [
  { name: 'markdown', convert: htmlToMarkdown, stream: streamHtmlToMarkdown },
  { name: 'text', convert: htmlToText, stream: streamHtmlToText },
  { name: 'html', convert: htmlToSafeHtml, stream: streamHtmlToSafeHtml },
]

const FIXTURES = ['github-markdown-complete.html', 'nuxt-example.html', 'wikipedia-small.html']
  .map(name => readFileSync(new URL(`../../../mdream/test/fixtures/${name}`, import.meta.url), 'utf8'))

const encoder = new TextEncoder()

function chunkStream(chunks: (Uint8Array | string)[]): ReadableStream<Uint8Array | string> {
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks)
        controller.enqueue(chunk)
      controller.close()
    },
  })
}

function bySize<T extends Uint8Array | string>(value: T, size: number): T[] {
  const chunks: T[] = []
  for (let index = 0; index < value.length; index += size)
    chunks.push(value.slice(index, index + size) as T)
  return chunks
}

async function drain(output: AsyncIterable<string>): Promise<string> {
  let result = ''
  for await (const chunk of output)
    result += chunk
  return result
}

/** Every way a small input can arrive: each two-chunk split, and byte and string runs. */
function streamSplits(html: string): (Uint8Array | string)[][] {
  const bytes = encoder.encode(html)
  const splits: (Uint8Array | string)[][] = [[html], bySize(html, 1), bySize(html, 7), bySize(bytes, 1), bySize(bytes, 3)]
  for (let index = 1; index < html.length; index++)
    splits.push([html.slice(0, index), html.slice(index)])
  return splits
}

// Every rule but `fragments`, which holds a stream back to the end: these
// rewrite links while the stream still yields output.
function incrementalCleanup(): MdreamOptions {
  return { clean: clean({ urls: true, emptyLinks: true, redundantLinks: true, selfLinkHeadings: true, emptyImages: true, emptyLinkText: true }) }
}

const OPTION_SETS: { name: string, options: () => MdreamOptions }[] = [
  { name: 'no options', options: () => ({}) },
  { name: 'minimal preset', options: () => withMinimalPreset({ clean: false, origin: 'https://example.com' }) },
  { name: 'minimal preset with cleanup', options: () => withMinimalPreset({ origin: 'https://example.com' }) },
  { name: 'cleanup without fragments', options: incrementalCleanup },
  { name: 'wrap width', options: () => ({ wrapWidth: 20 }) },
]

describe('stream output equals one-shot output', () => {
  for (const format of FORMATS) {
    for (const set of OPTION_SETS) {
      it(`${format.name} with ${set.name}, every corpus split`, async () => {
        for (const html of CONVERSION_CORPUS) {
          const expected = format.convert(html, set.options())
          for (const chunks of streamSplits(html)) {
            const actual = await drain(format.stream(chunkStream(chunks), set.options()))
            expect(actual, `${JSON.stringify(html)} in ${chunks.length} chunks`).toBe(expected)
          }
        }
      })
    }

    it(`${format.name}, fixtures in 64 and 4096 byte chunks`, async () => {
      for (const options of [undefined, incrementalCleanup()]) {
        for (const html of FIXTURES) {
          const expected = format.convert(html, options)
          const bytes = encoder.encode(html)
          for (const size of [64, 4096])
            expect(await drain(format.stream(chunkStream(bySize(bytes, size)), options))).toBe(expected)
        }
      }
    })
  }
})

describe('reused plugins match fresh plugins', () => {
  function pluginOptions(extracted: string[]): MdreamOptions {
    return withMinimalPreset({
      clean: false,
      plugins: [extractionPlugin({ 'h1, h2, a[href]': element => extracted.push(`${element.name}:${element.textContent}`) })],
    })
  }

  for (const format of FORMATS) {
    it(`${format.name}, sequential conversions`, () => {
      const sharedExtracted: string[] = []
      const freshExtracted: string[] = []
      const shared = pluginOptions(sharedExtracted)
      for (const html of [...CONVERSION_CORPUS, ...FIXTURES])
        expect(format.convert(html, shared)).toBe(format.convert(html, pluginOptions(freshExtracted)))
      expect(sharedExtracted).toEqual(freshExtracted)
    })

    it(`${format.name}, concurrent streams`, async () => {
      const shared = pluginOptions([])
      const inputs = [...CONVERSION_CORPUS, ...FIXTURES]
      const outputs = await Promise.all(inputs.map(html => drain(format.stream(chunkStream(bySize(html, 64)), shared))))
      expect(outputs).toEqual(inputs.map(html => format.convert(html, pluginOptions([]))))
    })
  }
})

describe('frontmatter onExtract reports once per document', () => {
  for (const format of FORMATS) {
    it(`${format.name}, sync and stream agree`, async () => {
      for (const html of CONVERSION_CORPUS) {
        const syncCalls: Record<string, string>[] = []
        const streamCalls: Record<string, string>[] = []
        format.convert(html, { plugins: [frontmatterPlugin({ additionalFields: { source: 'test' }, onExtract: fm => syncCalls.push(fm) })] })
        await drain(format.stream(chunkStream(bySize(html, 5)), { plugins: [frontmatterPlugin({ additionalFields: { source: 'test' }, onExtract: fm => streamCalls.push(fm) })] }))
        expect(syncCalls, JSON.stringify(html)).toHaveLength(1)
        expect(streamCalls, JSON.stringify(html)).toEqual(syncCalls)
      }
    })
  }

  it('reports the same data in every format', () => {
    for (const html of CONVERSION_CORPUS) {
      const payloads = FORMATS.map((format) => {
        let payload: Record<string, string> | undefined
        format.convert(html, {
          plugins: [frontmatterPlugin({
            onExtract: (fm) => {
              payload = fm
            },
          })],
        })
        return payload
      })
      expect(payloads[1], JSON.stringify(html)).toEqual(payloads[0])
      expect(payloads[2], JSON.stringify(html)).toEqual(payloads[0])
    }
  })
})
