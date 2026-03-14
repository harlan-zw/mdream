import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { Miniflare } from 'miniflare'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

// Test the actual edge.js entry point as it ships in the package
const edgeEntryPath = resolve(__dirname, '../../edge.js')
const wasmBindingsPath = resolve(__dirname, '../../wasm/mdream_edge.js')
const wasmBinaryPath = resolve(__dirname, '../../wasm/mdream_edge_bg.wasm')

// Worker that imports the edge entry point — mirrors real user code
const workerScript = `
import { htmlToMarkdown, MarkdownStream } from './edge.js';

export default {
  async fetch(request) {
    try {
      const url = new URL(request.url);

      if (url.pathname === '/convert') {
        const html = await request.text();
        const origin = url.searchParams.get('origin') || undefined;
        const result = htmlToMarkdown(html, origin ? { origin } : undefined);
        return Response.json(result);
      }

      if (url.pathname === '/stream') {
        const html = await request.text();
        const stream = new MarkdownStream();
        const chunkSize = 100;
        const chunks = [];
        for (let i = 0; i < html.length; i += chunkSize) {
          const result = stream.processChunk(html.slice(i, i + chunkSize));
          if (result) chunks.push(result);
        }
        const final = stream.finish();
        if (final) chunks.push(final);
        return new Response(chunks.join(''), { headers: { 'content-type': 'text/plain' } });
      }

      return new Response('Not found', { status: 404 });
    } catch (e) {
      return new Response('Error: ' + e.message + '\\n' + e.stack, { status: 500 });
    }
  }
};
`

describe('@mdream/engine-rust edge entry point (edge.js)', () => {
  let mf: Miniflare

  beforeAll(async () => {
    const edgeEntry = await readFile(edgeEntryPath, 'utf-8')
    const wasmBindings = await readFile(wasmBindingsPath, 'utf-8')
    const wasmBinary = await readFile(wasmBinaryPath)

    mf = new Miniflare({
      modules: [
        { type: 'ESModule', path: 'worker.js', contents: workerScript },
        { type: 'ESModule', path: 'edge.js', contents: edgeEntry },
        { type: 'ESModule', path: 'wasm/mdream_edge.js', contents: wasmBindings },
        { type: 'CompiledWasm', path: 'wasm/mdream_edge_bg.wasm', contents: wasmBinary },
      ],
      compatibilityDate: '2024-12-01',
    })
  })

  afterAll(async () => {
    await mf?.dispose()
  })

  it('should return NAPI-compatible result shape { markdown, extracted, frontmatter }', async () => {
    const res = await mf.dispatchFetch('http://localhost/convert', {
      method: 'POST',
      body: '<h1>Test</h1><p>Hello</p>',
    })
    const result = await res.json()
    expect(result).toHaveProperty('markdown')
    expect(result).toHaveProperty('extracted', null)
    expect(result).toHaveProperty('frontmatter', null)
    expect(result.markdown).toContain('# Test')
    expect(result.markdown).toContain('Hello')
  })

  it('should convert HTML to markdown', async () => {
    const res = await mf.dispatchFetch('http://localhost/convert', {
      method: 'POST',
      body: '<h1>Hello</h1><p>This is <strong>bold</strong> and <em>italic</em>.</p>',
    })
    const { markdown } = await res.json()
    expect(markdown).toContain('# Hello')
    expect(markdown).toContain('**bold**')
    expect(markdown).toContain('_italic_')
  })

  it('should resolve relative URLs with origin option', async () => {
    const res = await mf.dispatchFetch('http://localhost/convert?origin=https://example.com', {
      method: 'POST',
      body: '<a href="/about">About</a>',
    })
    const { markdown } = await res.json()
    expect(markdown).toContain('https://example.com/about')
  })

  it('should support streaming via MarkdownStream', async () => {
    const res = await mf.dispatchFetch('http://localhost/stream', {
      method: 'POST',
      body: '<h1>Streaming</h1><p>Works in edge runtime.</p>',
    })
    const md = await res.text()
    expect(md).toContain('# Streaming')
    expect(md).toContain('Works in edge runtime.')
  })

  it('should handle lists and blockquotes', async () => {
    const res = await mf.dispatchFetch('http://localhost/convert', {
      method: 'POST',
      body: '<ul><li>One</li><li>Two</li></ul><blockquote><p>Quote</p></blockquote>',
    })
    const { markdown } = await res.json()
    expect(markdown).toContain('- One')
    expect(markdown).toContain('- Two')
    expect(markdown).toContain('> Quote')
  })

  it('should handle code blocks', async () => {
    const res = await mf.dispatchFetch('http://localhost/convert', {
      method: 'POST',
      body: '<pre><code class="language-js">const x = 1;</code></pre>',
    })
    const { markdown } = await res.json()
    expect(markdown).toContain('const x = 1;')
  })

  it('should handle empty input', async () => {
    const res = await mf.dispatchFetch('http://localhost/convert', {
      method: 'POST',
      body: '',
    })
    const { markdown } = await res.json()
    expect(markdown.trim()).toBe('')
  })
})
