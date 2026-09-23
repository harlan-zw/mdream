import { describe, expect, it, vi } from 'vitest'
import { MarkdownStream as BrowserMarkdownStream, streamHtmlToMarkdown as browserStream, createMarkdownStream } from '../../src/browser.js'
import { MarkdownStream as EdgeMarkdownStream, streamHtmlToMarkdown as edgeStream } from '../../src/edge.js'

const { control, BindingMarkdownStream } = vi.hoisted(() => {
  const control = { failProcessChunkBytes: false }

  class BindingMarkdownStream {
    // wasm-bindgen encodes a string argument to UTF-8, so a lone surrogate
    // arrives as U+FFFD.
    processChunk(chunk: string): string {
      return `chunk:${new TextDecoder().decode(new TextEncoder().encode(chunk))}`
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
  { name: 'browser', make: () => createMarkdownStream(), StreamClass: BrowserMarkdownStream, stream: browserStream },
  { name: 'edge', make: async () => new EdgeMarkdownStream(), StreamClass: EdgeMarkdownStream, stream: edgeStream },
] as const

describe.each(engines)('$name MarkdownStream wrapper', ({ make, stream: streamHtml }) => {
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

  it('keeps a surrogate pair split across string chunks', async () => {
    const stream = await make()
    const out = stream.processChunk('<p>\uD83C') + stream.processChunk('\uDF89</p>') + stream.finish()
    expect(out).toBe('chunk:<p>chunk:🎉</p>')
  })

  it('flushes a lone high surrogate before bytes and at finish', async () => {
    const stream = await make()
    const out = stream.processChunk('a\uD83C')
      + stream.processChunkBytes(new TextEncoder().encode('b'))
      + stream.processChunk('c\uD83C')
      + stream.finish()
    expect(out).toBe('chunk:achunk:\uFFFDbytes:bchunk:cchunk:\uFFFD')
  })

  it('keeps a surrogate pair split across stream string chunks', async () => {
    const html = new ReadableStream<string>({
      start(controller) {
        for (const unit of '<p>🎉</p>'.split(''))
          controller.enqueue(unit)
        controller.close()
      },
    })
    let out = ''
    for await (const chunk of streamHtml(html))
      out += chunk
    expect(out).toBe('chunk:<chunk:pchunk:>chunk:chunk:🎉chunk:<chunk:/chunk:pchunk:>')
  })
})
