import { describe, expect, it, vi } from 'vitest'
import { MarkdownStream as BrowserMarkdownStream, createMarkdownStream } from '../../src/browser.js'
import { MarkdownStream as EdgeMarkdownStream } from '../../src/edge.js'

const { control, BindingMarkdownStream } = vi.hoisted(() => {
  const control = { failProcessChunkBytes: false }

  class BindingMarkdownStream {
    processChunk(chunk: string): string {
      return `chunk:${chunk}`
    }

    processChunkBytes(chunk: Uint8Array): string {
      if (control.failProcessChunkBytes)
        throw new WebAssembly.RuntimeError('unreachable')
      return `bytes:${new TextDecoder().decode(chunk)}`
    }

    finish(): string {
      return ''
    }
  }

  return { control, BindingMarkdownStream }
})

// The generated wasm binding cannot load under node vitest (ESM `.wasm`
// import, `fetch(file://)`), so stand in for it and test that the wrappers
// delegate byte chunks and report panics through `wasmPanicError`.
vi.mock('../../wasm/mdream_edge.js', () => ({
  default: () => Promise.resolve(),
  initSync: () => {},
  htmlToMarkdownResult: () => ({ markdown: '' }),
  __mdreamTakePanicMessage: () => 'synthetic panic',
  MarkdownStream: BindingMarkdownStream,
}))
vi.mock('../../wasm/mdream_edge_bg.wasm', () => ({ default: {} }))

const engines = [
  { name: 'browser', make: () => createMarkdownStream(), StreamClass: BrowserMarkdownStream },
  { name: 'edge', make: async () => new EdgeMarkdownStream(), StreamClass: EdgeMarkdownStream },
] as const

describe.each(engines)('$name MarkdownStream wrapper', ({ make }) => {
  it('delegates processChunkBytes and returns the converted markdown', async () => {
    control.failProcessChunkBytes = false
    const stream = await make()
    const bytes = new TextEncoder().encode('<p>hi</p>')
    expect(stream.processChunkBytes(bytes)).toBe('bytes:<p>hi</p>')
  })

  it('reports panics thrown by processChunkBytes through wasmPanicError', async () => {
    control.failProcessChunkBytes = true
    try {
      const stream = await make()
      expect(() => stream.processChunkBytes(new Uint8Array([0x3C]))).toThrow(/mdream WASM panic[\s\S]*synthetic panic/)
    }
    finally {
      control.failProcessChunkBytes = false
    }
  })
})
