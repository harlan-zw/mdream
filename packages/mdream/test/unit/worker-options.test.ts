import type { HtmlToMarkdownOptions } from '../../napi/index.js'
import { afterAll, describe, expect, it, vi } from 'vitest'
import { htmlToMarkdown as engineHtmlToMarkdown } from '../../napi/index.mjs'
import { htmlToMarkdown as nodeHtmlToMarkdown } from '../../src/index.js'
import { htmlToMarkdown, initWorker, terminateWorker } from '../../src/worker.js'

// Node has no Web Worker. Stand in for one that runs the engine binding on
// whatever it receives, which is what the real worker script does, so the
// test checks the options that cross `postMessage` and the callbacks after it.
const posted: { options: HtmlToMarkdownOptions }[] = []

class FakeWorker {
  onmessage: ((e: { data: unknown }) => void) | null = null
  onerror: ((e: { message: string }) => void) | null = null

  constructor() {
    queueMicrotask(() => this.onmessage?.({ data: { type: 'ready' } }))
  }

  postMessage(msg: { id: number, html: string, options: HtmlToMarkdownOptions }) {
    // structuredClone throws on functions, as the real postMessage does
    posted.push(structuredClone({ options: msg.options }))
    const data = engineHtmlToMarkdown(msg.html, msg.options)
    queueMicrotask(() => this.onmessage?.({ data: { id: msg.id, type: 'result', data } }))
  }

  terminate() {}
}

vi.stubGlobal('Worker', FakeWorker)
vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: () => 'blob:mdream', revokeObjectURL: () => {} }))

afterAll(() => {
  terminateWorker()
  vi.unstubAllGlobals()
})

describe('mdream/worker', () => {
  const html = '<html><head><title>Page</title></head><body><nav>Menu</nav><main><h1>Hello</h1><a href="/a">A</a></main></body></html>'

  it('resolves minimal before posting, matching the Node entry', async () => {
    await initWorker('https://example.com/mdream_edge_bg.wasm')
    expect(await htmlToMarkdown(html, { minimal: true })).toBe(nodeHtmlToMarkdown(html, { minimal: true }))
    expect(posted.at(-1)!.options.plugins).toMatchObject({ frontmatter: {}, isolateMain: true, filter: { exclude: expect.arrayContaining(['nav']) } })
  })

  it('runs the frontmatter callback and extraction handlers on this thread', async () => {
    const frontmatter = vi.fn()
    const link = vi.fn()
    await htmlToMarkdown(html, { frontmatter, extraction: { 'a[href]': link } })
    expect(frontmatter).toHaveBeenCalledWith({ title: 'Page' })
    expect(link).toHaveBeenCalledWith(expect.objectContaining({ tagName: 'a', attributes: { href: '/a' } }))
  })
})
