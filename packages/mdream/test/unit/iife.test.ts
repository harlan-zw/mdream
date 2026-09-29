import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { describe, expect, it, vi } from 'vitest'
import { htmlToMarkdown as nodeHtmlToMarkdown } from '../../src/index.js'

// The CDN script is assembled by build.config.ts, so this reads the build output.
function loadIife() {
  const code = readFileSync(new URL('../../dist/iife.js', import.meta.url), 'utf8')
  const window: Record<string, any> = {}
  runInNewContext(code, { window, atob, TextDecoder, TextEncoder, WebAssembly })
  return window.mdream
}

describe('cDN build (dist/iife.js)', () => {
  const html = '<html><head><title>Page</title></head><body><nav>Menu</nav><main><h1>Hello</h1><a href="/a">A</a></main></body></html>'

  it('is ready at load and resolves options like the Node entry', () => {
    const mdream = loadIife()
    expect(mdream.htmlToMarkdown(html, { minimal: true }).markdown).toBe(nodeHtmlToMarkdown(html, { minimal: true }))
    expect(mdream.htmlToMarkdown(html, { tagOverrides: { h1: 'h2' } }).markdown).toBe(nodeHtmlToMarkdown(html, { tagOverrides: { h1: 'h2' } }))
  })

  it('calls the frontmatter callback and extraction handlers', () => {
    const frontmatter = vi.fn()
    const link = vi.fn()
    loadIife().htmlToMarkdown(html, { frontmatter, extraction: { 'a[href]': link } })
    expect(frontmatter).toHaveBeenCalledWith({ title: 'Page' })
    expect(link).toHaveBeenCalledOnce()
  })
})
