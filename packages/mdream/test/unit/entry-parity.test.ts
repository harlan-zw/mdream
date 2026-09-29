import type { MdreamOptions } from '../../src'
import { describe, expect, it, vi } from 'vitest'
import * as browser from '../../src/browser.js'
import * as edge from '../../src/edge.js'
import * as node from '../../src/index.js'
import * as wasm from '../../src/wasm.js'

// Load the real WASM engine under node: edge imports the `.wasm` file as a
// compiled module, and the browser entry's async init would fetch a file URL.
vi.mock('../../wasm/mdream_edge_bg.wasm', async () => {
  const { readFileSync } = await import('node:fs')
  return { default: new WebAssembly.Module(readFileSync(new URL('../../wasm/mdream_edge_bg.wasm', import.meta.url))) }
})
vi.mock('../../wasm/mdream_edge.js', async (importOriginal) => {
  const { readFileSync } = await import('node:fs')
  const bindings = await importOriginal<typeof import('../../wasm/mdream_edge.js')>()
  const bytes = readFileSync(new URL('../../wasm/mdream_edge_bg.wasm', import.meta.url))
  return { ...bindings, default: async () => bindings.initSync({ module: bytes }) }
})

type Convert = (html: string, options: Partial<MdreamOptions>) => Promise<string>
type Stream = typeof node.streamHtmlToMarkdown

await wasm.default()

const entries: { name: string, convert: Convert, stream: Stream }[] = [
  { name: 'node', convert: async (html, options) => node.htmlToMarkdown(html, options), stream: node.streamHtmlToMarkdown },
  { name: 'edge', convert: async (html, options) => edge.htmlToMarkdown(html, options), stream: edge.streamHtmlToMarkdown },
  { name: 'browser', convert: async (html, options) => (await browser.htmlToMarkdown(html, options)).markdown, stream: browser.streamHtmlToMarkdown },
  { name: 'wasm', convert: async (html, options) => wasm.htmlToMarkdown(html, options), stream: (htmlStream, options) => streamWith(wasm.MarkdownStream, htmlStream, options) },
]

async function* streamWith(Stream: typeof wasm.MarkdownStream, htmlStream: ReadableStream<Uint8Array | string> | null, options?: Partial<MdreamOptions>): AsyncIterable<string> {
  const stream = new Stream(options)
  const reader = htmlStream!.getReader()
  while (true) {
    const { done, value } = await reader.read()
    if (done)
      break
    yield stream.processChunk(value as string)
  }
  yield stream.finish()
}

function toStream(chunks: string[]): ReadableStream<string> {
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks)
        controller.enqueue(chunk)
      controller.close()
    },
  })
}

async function collect(stream: AsyncIterable<string>): Promise<string> {
  let out = ''
  for await (const chunk of stream)
    out += chunk
  return out
}

const PAGE = '<html><head><title>Page</title><meta name="description" content="About"></head><body><nav>Menu</nav><main><h1>Hello</h1><form>Sign up</form><p class="font-bold">Bold</p><a href="/a">A</a><x-note>Note</x-note></main><footer>Footer</footer></body></html>'

const optionCases: [string, Partial<MdreamOptions>][] = [
  ['minimal', { minimal: true }],
  ['frontmatter', { frontmatter: true }],
  ['filter', { filter: { exclude: ['nav', 'form'] } }],
  ['isolateMain', { isolateMain: true }],
  ['tagOverrides', { tagOverrides: { 'x-note': 'strong' } }],
  ['clean', { clean: true, origin: 'https://example.com' }],
]

describe.each(entries)('$name entry', ({ name, convert, stream }) => {
  it.each(optionCases)('resolves %s the same way as the Node entry', async (_, options) => {
    expect(await convert(PAGE, options), name).toBe(node.htmlToMarkdown(PAGE, options))
  })

  it('calls the frontmatter callback and extraction handlers', async () => {
    const frontmatter = vi.fn()
    const link = vi.fn()
    await convert(PAGE, { frontmatter, extraction: { 'a[href]': link } })
    expect(frontmatter).toHaveBeenCalledWith({ title: 'Page', description: 'About' })
    expect(link).toHaveBeenCalledWith(expect.objectContaining({ selector: 'a[href]', tagName: 'a', attributes: { href: '/a' } }))
  })

  it('streams with the same options and callbacks as one-shot', async () => {
    const frontmatter = vi.fn()
    const link = vi.fn()
    const options: Partial<MdreamOptions> = { minimal: true, frontmatter, extraction: { 'a[href]': link } }
    const markdown = await collect(stream(toStream([PAGE.slice(0, 40), PAGE.slice(40)]), options))
    expect(markdown).toBe(node.htmlToMarkdown(PAGE, { minimal: true }))
    expect(frontmatter).toHaveBeenCalledWith({ title: 'Page', description: 'About' })
    expect(link).toHaveBeenCalledOnce()
  })
})
