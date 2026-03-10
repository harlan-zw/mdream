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
          const md = engine.htmlToMarkdown(html)
          expect(md.length).toBeGreaterThan(minOutputKB * 1024)
        })

        it('streaming conversion produces meaningful output', async () => {
          const engine = await resolveEngine(engineThunk)
          const md = await collectStream(engine.streamHtmlToMarkdown(stringToStream(html)))
          expect(md.length).toBeGreaterThan(minOutputKB * 1024)
        })

        it('string and streaming output match', async () => {
          const engine = await resolveEngine(engineThunk)
          const stringResult = engine.htmlToMarkdown(html)
          const streamResult = await collectStream(engine.streamHtmlToMarkdown(stringToStream(html)))
          // Streaming may produce trailing whitespace from final flush
          expect(streamResult.trimEnd()).toBe(stringResult.trimEnd())
        })
      })
    }
  })
}
