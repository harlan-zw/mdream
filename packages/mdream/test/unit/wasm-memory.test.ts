import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import * as wasm from '../../src/wasm.js'

// WASM linear memory never shrinks, so what an instance starts with and what
// one conversion grows it by stay allocated for the instance's life. This file
// runs in its own module graph, so the instance is fresh.
const PAGE = 64 * 1024
const WASM_CHUNK_BYTES = 16 * 1024
const exports = await wasm.default({ module_or_path: readFileSync(new URL('../../wasm/mdream_edge_bg.wasm', import.meta.url)) })
const initial = exports.memory.buffer.byteLength

describe('wasm linear memory', () => {
  it('grows by a bounded amount for a large non-ASCII page', () => {
    const html = `<main>${'<p>Ünïcödé — 日本語 🎉 <a href="/b">link</a> text</p>'.repeat(17_000)}</main>`
    expect(new TextEncoder().encode(html).length).toBeGreaterThan(1024 * 1024)

    const encodeSpy = vi.spyOn(TextEncoder.prototype, 'encode')
    const encodeIntoSpy = vi.spyOn(TextEncoder.prototype, 'encodeInto')
    let markdown: string
    let encodedByteBuffers: number[]
    try {
      markdown = wasm.htmlToMarkdown(html)
      encodedByteBuffers = [
        ...encodeSpy.mock.results.map(({ value }) => value.byteLength),
        ...encodeIntoSpy.mock.calls.map(([, destination]) => destination.byteLength),
      ]
    }
    finally {
      encodeSpy.mockRestore()
      encodeIntoSpy.mockRestore()
    }

    expect(markdown.length).toBeGreaterThan(512 * 1024)
    // A whole-input string copy alone would take 3 MiB.
    expect(exports.memory.buffer.byteLength - initial).toBeLessThanOrEqual(4 * PAGE)
    expect(Math.max(...encodedByteBuffers)).toBeLessThanOrEqual(WASM_CHUNK_BYTES)
    expect(encodedByteBuffers.length).toBeGreaterThan(1)
  })
})
