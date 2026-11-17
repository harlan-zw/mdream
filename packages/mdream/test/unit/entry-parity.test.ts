import type { MdreamOptions } from '../../src'
import { describe, expect, it, vi } from 'vitest'
import * as browserStub from '../../src/browser-stub.js'
import * as browser from '../../src/browser.js'
import { convertWasm } from '../../src/convert.js'
import * as edge from '../../src/edge.js'
import * as node from '../../src/index.js'
import * as wasm from '../../src/wasm.js'

// Load the real WASM engine under node: edge imports the `.wasm` file as a
// compiled module, and the browser entry's async init would fetch a file URL.
vi.mock('../../wasm/mdream_edge_bg.wasm', async () => {
  const { readFileSync } = await import('node:fs')
  return { default: new WebAssembly.Module(readFileSync(new URL('../../wasm/mdream_edge_bg.wasm', import.meta.url))) }
})
vi.mock('../../wasm-bundler/mdream_edge_bg.wasm', async () => {
  const { readFileSync } = await import('node:fs')
  return { default: new WebAssembly.Module(readFileSync(new URL('../../wasm-bundler/mdream_edge_bg.wasm', import.meta.url))) }
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
  { name: 'browser', convert: (html, options) => browser.htmlToMarkdown(html, options), stream: browser.streamHtmlToMarkdown },
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
const WASM_CHUNK = 16 * 1024
const MANY_CHUNKS = '<p>pad</p>'.repeat(4000)
const PADDINGS: [string, string][] = [['in one call', ''], ['in many chunks', MANY_CHUNKS]]

const optionCases: [string, Partial<MdreamOptions>][] = [
  ['minimal', { minimal: true }],
  ['frontmatter', { frontmatter: true }],
  ['filter', { filter: { exclude: ['nav', 'form'] } }],
  ['isolateMain', { isolateMain: true }],
  ['tagOverrides', { tagOverrides: { 'x-note': 'strong' } }],
  ['clean', { clean: true, origin: 'https://example.com' }],
]

// Node, edge, and raw WASM return a string; the browser entry returns a
// Promise of the same string. export-types.test.ts checks the types match.
describe('return contract', () => {
  it('returns the Markdown string', async () => {
    for (const convert of [node.htmlToMarkdown, edge.htmlToMarkdown, wasm.htmlToMarkdown])
      expect(convert('<h1>Hi</h1>', {})).toBe('# Hi')
    const pending = browser.htmlToMarkdown('<h1>Hi</h1>', {})
    expect(pending).toBeInstanceOf(Promise)
    expect(await pending).toBe('# Hi')
  })
})

describe.each(entries)('$name entry', ({ name, convert, stream }) => {
  it.each(optionCases)('resolves %s the same way as the Node entry', async (_, options) => {
    expect(await convert(PAGE, options), name).toBe(node.htmlToMarkdown(PAGE, options))
  })

  it.each([
    ['non-ASCII text', '<p>Ünïcödé — 日本語 🎉</p>'],
    ['a lone surrogate', '<p>a\uD83Cb</p><p>c\uDF89</p>'],
    ['a leading BOM', `${String.fromCharCode(0xFEFF)}<p>x</p>`],
  ])('converts %s in many chunks like the Node entry', async (_, text) => {
    const html = text + MANY_CHUNKS
    expect(await convert(html, {}), name).toBe(node.htmlToMarkdown(html, {}))
  })

  it.each(PADDINGS)('drops an NBSP-only link %s like the Node entry', async (_, padding) => {
    const html = `${padding}<ul><li><ul><li><a href="">&nbsp;</a></li></ul></li></ul>`
    expect(await convert(html, { clean: true }), name).toBe(node.htmlToMarkdown(html, { clean: true }))
  })

  it('keeps a surrogate pair intact across an input chunk boundary', async () => {
    const html = `<p>${'a'.repeat(WASM_CHUNK - 4)}🎉tail</p>`
    expect(await convert(html, {}), name).toBe(node.htmlToMarkdown(html, {}))
  })

  it.each(optionCases)('converts a page of many chunks with %s like the Node entry', async (_, options) => {
    const big = PAGE.replace('<p class="font-bold">Bold</p>', '<p>Ünïcödé — 日本語 🎉 <a href="/b">b</a></p>'.repeat(3000))
    expect(new TextEncoder().encode(big).length).toBeGreaterThan(128 * 1024)
    const collecting = (seen: unknown[]): Partial<MdreamOptions> => ({ ...options, frontmatter: f => seen.push(f), extraction: { 'a[href]': e => seen.push(e) } })
    const seen: unknown[] = []
    const expected: unknown[] = []
    expect(await convert(big, collecting(seen)), name).toBe(node.htmlToMarkdown(big, collecting(expected)))
    expect(await convert(big, options), name).toBe(node.htmlToMarkdown(big, options))
    expect(seen).toEqual(expected)
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

describe('wasm entry', () => {
  it('converts a small input without a stream', () => {
    const engine = {
      oneShot: () => ({ markdown: '# one-shot' }),
      Stream: class {
        constructor() {
          throw new Error('built a stream')
        }
      } as never,
    }
    expect(convertWasm('<h1>Hi</h1>', {} as never, engine).markdown).toBe('# one-shot')
  })

  it('returns the Markdown first in the result, as the one-shot binding does', () => {
    const big = `${PAGE}${'<p>pad</p>'.repeat(100)}`
    expect(Object.keys(wasm.htmlToMarkdownResult(big, { frontmatter: true }))).toEqual(['markdown', 'frontmatter'])
  })

  it.each([
    ['a code point', [0xF0, 0x9F, 0x8E, 0x89]],
    ['an invalid sequence', [0xE6, 0x97, 0xFF, 0xC3]],
  ])('converts bytes with %s across a chunk boundary like the Node entry', (_, cut) => {
    const encoder = new TextEncoder()
    const head = encoder.encode(`\uFEFF<p>${'a'.repeat(WASM_CHUNK - 9)}`)
    const tail = encoder.encode(`tail</p>${'<p>pad</p>'.repeat(4000)}`)
    const bytes = new Uint8Array([...head, ...cut, ...tail])
    for (const offset of [0, 1, 2, 3]) {
      const shifted = bytes.subarray(offset)
      expect(wasm.htmlToMarkdownBytes(shifted)).toBe(node.htmlToMarkdown(new TextDecoder().decode(shifted)))
    }
  })
})

// The root `mdream` entry under the `browser` condition. It must offer every
// runtime name the Node entry offers, so a browser bundle that imports one
// still builds, and each call points the caller to `mdream/browser`.
describe('root entry in a browser bundle', () => {
  it('exports the same runtime names as the Node entry', () => {
    expect(Object.keys(browserStub).sort()).toEqual(Object.keys(node).sort())
  })

  it.each(Object.entries(browserStub))('%s throws a TypeError that names mdream/browser', (name, call) => {
    expect(call).toThrow(TypeError)
    expect(call).toThrow(`import ${name} from 'mdream/browser'`)
  })
})
