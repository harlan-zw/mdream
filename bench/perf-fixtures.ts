import { createHash } from 'node:crypto'

export const STREAM_CHUNK_SIZE = 8 * 1024
export const STREAM_BODY_SIZES = [2 * 1024 * 1024, 8 * 1024 * 1024] as const
export const EXCLUDED_BODY_SIZES = [256 * 1024, 1024 * 1024] as const
export const PARAGRAPH = '<p>Ordinary words in a small paragraph.</p>'

export type StreamFixtureKind = 'style' | 'comment' | 'cdata' | 'quote' | 'metadata' | 'metadata-quote'

export function unicodeHtml(repeats = 25_000): string {
  return `<p>${'東京日本語🙂éλληνικά'.repeat(repeats)}</p>`
}

export function streamFixture(kind: StreamFixtureKind, bodyBytes: number) {
  const paragraphs = kind === 'quote' || kind === 'metadata' || kind === 'metadata-quote'
  const unit = paragraphs ? PARAGRAPH : 'ignored '
  const units = Math.ceil(bodyBytes / unit.length)
  const unitsPerChunk = Math.floor(STREAM_CHUNK_SIZE / unit.length)
  const metadata = '<head><title>Benchmark title</title></head><h2>Intro</h2>'
  const prefix = {
    'style': '<style>',
    'comment': '<!--',
    'cdata': '<![CDATA[',
    'quote': '<blockquote>',
    'metadata': metadata,
    'metadata-quote': `${metadata}<blockquote>`,
  }[kind]
  const suffix = {
    'style': '</style>',
    'comment': '-->',
    'cdata': ']]>',
    'quote': '</blockquote>',
    'metadata': '',
    'metadata-quote': '</blockquote>',
  }[kind]

  return {
    bodyBytes: units * unit.length,
    bodyChunks: Math.ceil(units / unitsPerChunk),
    * chunks(): Generator<string> {
      yield prefix
      for (let remaining = units; remaining > 0;) {
        const count = Math.min(remaining, unitsPerChunk)
        yield unit.repeat(count)
        remaining -= count
      }
      yield `${suffix}<p>after</p>`
    },
  }
}

// Each span closes a text node, while the quoted line has no safe newline.
export function longLineFixture(bodyBytes = 1024 * 1024, quoted = true) {
  const count = Math.ceil(bodyBytes / 1024)
  const unit = `<span>${'x'.repeat(1024)}</span>`
  return {
    bodyBytes: count * 1024,
    * chunks(): Generator<string> {
      yield quoted ? '<blockquote>' : '<div>'
      for (let index = 0; index < count; index++)
        yield unit
      yield quoted ? '</blockquote>' : '</div>'
    },
  }
}

interface Clock {
  wall: () => number
  cpu: () => number
}

export type FirstOutput
  = | { _tag: 'None' }
    | { _tag: 'Emitted', inputChunks: number, wallMs: number, cpuMs: number }

interface StreamHooks {
  clock: Clock
  beforeInput?: (inputChunks: number) => void
}

export interface StreamObservation {
  length: number
  digest: Buffer
  inputChunks: number
  firstOutput: FirstOutput
}

type StreamConverter = (source: ReadableStream<string>) => AsyncIterable<string>

// A zero-watermark source counts only chunks requested by the converter.
// The caller can sample retained heap before each input without retaining output.
async function consumeJsStream(
  convert: StreamConverter,
  chunks: Iterable<string>,
  { clock, beforeInput }: StreamHooks,
  consume: (output: string) => void,
): Promise<Omit<StreamObservation, 'digest'>> {
  const iterator = chunks[Symbol.iterator]()
  let inputChunks = 0
  const source = new ReadableStream<string>({
    pull(controller) {
      beforeInput?.(inputChunks)
      const next = iterator.next()
      if (next.done) {
        controller.close()
      }
      else {
        inputChunks++
        controller.enqueue(next.value)
      }
    },
    cancel() {
      iterator.return?.()
    },
  }, { highWaterMark: 0 })
  let length = 0
  let firstOutput: FirstOutput = { _tag: 'None' }
  const wallStart = clock.wall()
  const cpuStart = clock.cpu()
  for await (const output of convert(source)) {
    if (output.length && firstOutput._tag === 'None') {
      firstOutput = {
        _tag: 'Emitted',
        inputChunks,
        wallMs: clock.wall() - wallStart,
        cpuMs: clock.cpu() - cpuStart,
      }
    }
    length += output.length
    consume(output)
  }
  return { length, inputChunks, firstOutput }
}

export async function observeJsStream(
  convert: StreamConverter,
  chunks: Iterable<string>,
  hooks: StreamHooks,
): Promise<StreamObservation> {
  const hash = createHash('sha256')
  const observation = await consumeJsStream(convert, chunks, hooks, (output) => {
    hash.update(output)
  })
  return { ...observation, digest: hash.digest() }
}

// Timed runs count output without paying for the verification digest.
export async function countJsStream(
  convert: StreamConverter,
  chunks: Iterable<string>,
  hooks: StreamHooks,
): Promise<number> {
  const observation = await consumeJsStream(convert, chunks, hooks, () => {})
  return observation.length
}
