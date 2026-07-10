import { beforeEach, describe, expect, it, vi } from 'vitest'

// The edge/browser/iife/worker entries are all WASM-backed. Previously they
// passed raw user options straight to the engine, so minimal/isolateMain/filter
// were silently ignored (harlan-zw/mdream#117). These tests mock the WASM module
// and assert each entry now funnels options through resolveOptions() — i.e. the
// engine receives the normalized `plugins` shape.

const { capture, makeWasmMock } = vi.hoisted(() => {
  const capture: { opts: any, kind: 'convert' | 'stream' }[] = []
  const makeWasmMock = () => ({
    htmlToMarkdownResult: (_html: string, opts: any) => {
      capture.push({ opts, kind: 'convert' })
      return { markdown: '# md', frontmatter: undefined, extracted: [] }
    },
    MarkdownStream: class {
      constructor(opts: any) {
        capture.push({ opts, kind: 'stream' })
      }

      processChunk() { return '' }
      finish() { return '' }
    },
    initSync: () => {},
    default: () => Promise.resolve(),
  })
  return { capture, makeWasmMock }
})

vi.mock('../../wasm-bundler/mdream_edge.js', () => makeWasmMock())
vi.mock('../../wasm/mdream_edge.js', () => makeWasmMock())

const USER_OPTS = { minimal: true, isolateMain: true, filter: { exclude: ['header', 'footer', 'nav'] } }

function lastPlugins() {
  return capture.at(-1)!.opts.plugins
}

beforeEach(() => {
  capture.length = 0
})

describe('edge entry', () => {
  it('normalizes user options into the engine plugins shape', async () => {
    const { htmlToMarkdown } = await import('../../src/edge.ts')
    const md = htmlToMarkdown('<main>x</main>', USER_OPTS)
    expect(md).toBe('# md')
    expect(lastPlugins().isolateMain).toBe(true)
    expect(lastPlugins().filter).toEqual({ exclude: ['header', 'footer', 'nav'] })
  })

  it('normalizes MarkdownStream constructor options', async () => {
    const { MarkdownStream } = await import('../../src/edge.ts')
    void new MarkdownStream({ isolateMain: true })
    expect(capture.at(-1)!.kind).toBe('stream')
    expect(lastPlugins().isolateMain).toBe(true)
  })

  it('rejects hook (array) plugins', async () => {
    const { htmlToMarkdown } = await import('../../src/edge.ts')
    expect(() => htmlToMarkdown('<p>x</p>', { plugins: [] } as any)).toThrow(/@mdream\/js/)
  })
})

describe('browser entry', () => {
  it('normalizes user options and preserves the full result contract', async () => {
    const { htmlToMarkdown } = await import('../../src/browser.ts')
    const result = await htmlToMarkdown('<main>x</main>', USER_OPTS)
    // browser returns the full MdreamNapiResult, not just the markdown string
    expect(result).toMatchObject({ markdown: '# md' })
    expect(lastPlugins().isolateMain).toBe(true)
    expect(lastPlugins().filter).toEqual({ exclude: ['header', 'footer', 'nav'] })
  })
})

describe('iife entry', () => {
  it('normalizes user options and preserves the full result contract', async () => {
    const iife = await import('../../src/iife.ts')
    await iife.init(new ArrayBuffer(8))
    const result = iife.htmlToMarkdown('<main>x</main>', USER_OPTS)
    expect(result).toMatchObject({ markdown: '# md' })
    expect(lastPlugins().isolateMain).toBe(true)
    expect(lastPlugins().filter).toEqual({ exclude: ['header', 'footer', 'nav'] })
  })
})

// Augment (don't replace) the real URL so `new URL(...)` still works for node/vitest.
function stubObjectUrl() {
  const url = globalThis.URL as any
  const hadCreate = 'createObjectURL' in url
  const prevCreate = url.createObjectURL
  const prevRevoke = url.revokeObjectURL
  url.createObjectURL = () => 'blob:mdream-test'
  url.revokeObjectURL = () => {}
  return () => {
    if (hadCreate) {
      url.createObjectURL = prevCreate
      url.revokeObjectURL = prevRevoke
    }
    else {
      delete url.createObjectURL
      delete url.revokeObjectURL
    }
  }
}

describe('worker entry', () => {
  it('posts normalized napiOpts across the worker boundary', async () => {
    const workers: FakeWorker[] = []
    class FakeWorker {
      onmessage: ((e: { data: any }) => void) | null = null
      onerror: ((e: any) => void) | null = null
      posted: any[] = []
      constructor() {
        workers.push(this)
        queueMicrotask(() => this.onmessage?.({ data: { type: 'ready' } }))
      }

      postMessage(msg: any) {
        this.posted.push(msg)
        if (msg.type === 'convert')
          queueMicrotask(() => this.onmessage?.({ data: { id: msg.id, type: 'result', data: 'MD' } }))
      }

      terminate() {}
    }
    vi.stubGlobal('Worker', FakeWorker as any)
    const restoreUrl = stubObjectUrl()

    const worker = await import('../../src/worker.ts')
    try {
      await worker.initWorker('http://x/mdream_edge_bg.wasm')
      const md = await worker.htmlToMarkdown('<main>x</main>', USER_OPTS)
      expect(md).toBe('MD')

      const convertMsg = workers[0].posted.find(m => m.type === 'convert')
      expect(convertMsg.options.plugins.isolateMain).toBe(true)
      expect(convertMsg.options.plugins.filter).toEqual({ exclude: ['header', 'footer', 'nav'] })
    }
    finally {
      worker.terminateWorker()
      restoreUrl()
      vi.unstubAllGlobals()
    }
  })

  it('rejects hook (array) plugins after init', async () => {
    const workers: FakeWorker[] = []
    class FakeWorker {
      onmessage: ((e: { data: any }) => void) | null = null
      onerror: ((e: any) => void) | null = null
      posted: any[] = []
      constructor() {
        workers.push(this)
        queueMicrotask(() => this.onmessage?.({ data: { type: 'ready' } }))
      }

      postMessage(msg: any) { this.posted.push(msg) }
      terminate() {}
    }
    vi.stubGlobal('Worker', FakeWorker as any)
    const restoreUrl = stubObjectUrl()

    const worker = await import('../../src/worker.ts')
    try {
      await worker.initWorker('http://x/mdream_edge_bg.wasm')
      await expect(worker.htmlToMarkdown('<p>x</p>', { plugins: [] } as any)).rejects.toThrow(/@mdream\/js/)
      // nothing should have been posted for the rejected call
      expect(workers[0].posted.length).toBe(0)
    }
    finally {
      worker.terminateWorker()
      restoreUrl()
      vi.unstubAllGlobals()
    }
  })
})
