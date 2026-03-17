import init, { htmlToMarkdown, htmlToMarkdownResult, MarkdownStream } from '../wasm/mdream_edge.js'
// @ts-expect-error wasm module import
import wasmModule from '../wasm/mdream_edge_bg.wasm'

let initialized = false

async function ensureInit() {
  if (!initialized) {
    await init(wasmModule)
    initialized = true
  }
}

export default {
  async fetch(request: Request): Promise<Response> {
    await ensureInit()

    const url = new URL(request.url)

    if (url.pathname === '/convert' && request.method === 'POST') {
      const html = await request.text()
      const origin = url.searchParams.get('origin') || undefined
      const md = htmlToMarkdown(html, origin ? { origin } : undefined)
      return new Response(md, { headers: { 'content-type': 'text/plain' } })
    }

    if (url.pathname === '/result' && request.method === 'POST') {
      const html = await request.text()
      const result = htmlToMarkdownResult(html, {
        plugins: {
          extraction: { selectors: ['h1', 'h2'] },
          frontmatter: {},
        },
      })
      return Response.json(result)
    }

    if (url.pathname === '/stream' && request.method === 'POST') {
      const html = await request.text()
      const stream = new MarkdownStream()
      const chunkSize = 512
      let md = ''
      for (let i = 0; i < html.length; i += chunkSize) {
        md += stream.processChunk(html.slice(i, i + chunkSize))
      }
      md += stream.finish()
      return new Response(md, { headers: { 'content-type': 'text/plain' } })
    }

    return new Response('Not found', { status: 404 })
  },
}
