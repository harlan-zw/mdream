import type { MdreamOptions } from 'mdream'
import { htmlToMarkdown as pkgHtmlToMarkdown, streamHtmlToMarkdown as pkgStreamHtmlToMarkdown } from 'mdream'
import init, { htmlToMarkdown, htmlToMarkdownResult, MarkdownStream } from '../wasm/mdream_edge.js'
// @ts-expect-error wasm module import
import wasmModule from '../wasm/mdream_edge_bg.wasm'

let initialized = false

const isolationOptions = {
  minimal: true,
  isolateMain: true,
  filter: { exclude: ['nav', 'footer'] },
} satisfies Partial<MdreamOptions>

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

    // Regression for #119: the `mdream` package resolves the `workerd` export
    // condition and must work without manual wasm init.
    if (url.pathname === '/pkg/convert' && request.method === 'POST') {
      const html = await request.text()
      const md = pkgHtmlToMarkdown(html)
      return new Response(md, { headers: { 'content-type': 'text/plain' } })
    }

    if (url.pathname === '/pkg/stream' && request.method === 'POST') {
      let md = ''
      for await (const chunk of pkgStreamHtmlToMarkdown(request.body)) {
        md += chunk
      }
      return new Response(md, { headers: { 'content-type': 'text/plain' } })
    }

    // Regression for #117: the public options must be normalized before they
    // reach the low-level WASM engine selected by the workerd condition.
    if (url.pathname === '/pkg/options' && request.method === 'POST') {
      const html = await request.text()
      return new Response(pkgHtmlToMarkdown(html, isolationOptions), {
        headers: { 'content-type': 'text/plain' },
      })
    }

    if (url.pathname === '/pkg/options/stream' && request.method === 'POST') {
      let md = ''
      for await (const chunk of pkgStreamHtmlToMarkdown(request.body, isolationOptions)) {
        md += chunk
      }
      return new Response(md, { headers: { 'content-type': 'text/plain' } })
    }

    if (url.pathname === '/pkg/options/callbacks' && request.method === 'POST') {
      let frontmatter: Record<string, string> | undefined
      let heading: { tagName: string, textContent: string } | undefined
      const markdown = pkgHtmlToMarkdown(await request.text(), {
        frontmatter: (value) => { frontmatter = value },
        extraction: {
          h1: (element) => { heading = element },
        },
      })
      return Response.json({ markdown, frontmatter, heading })
    }

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
