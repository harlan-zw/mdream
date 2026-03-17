import { SELF } from 'cloudflare:test'
import { describe, expect, it } from 'vitest'

describe('mdream WASM in Workers runtime', () => {
  it('converts basic HTML to Markdown', async () => {
    const res = await SELF.fetch('http://localhost/convert', {
      method: 'POST',
      body: '<h1>Hello</h1><p>World</p>',
    })
    const md = await res.text()
    expect(md).toContain('# Hello')
    expect(md).toContain('World')
  })

  it('handles links with origin', async () => {
    const res = await SELF.fetch('http://localhost/convert?origin=https://example.com', {
      method: 'POST',
      body: '<a href="/about">About</a>',
    })
    const md = await res.text()
    expect(md).toContain('[About](https://example.com/about)')
  })

  it('converts tables', async () => {
    const res = await SELF.fetch('http://localhost/convert', {
      method: 'POST',
      body: '<table><thead><tr><th>Name</th><th>Value</th></tr></thead><tbody><tr><td>A</td><td>1</td></tr></tbody></table>',
    })
    const md = await res.text()
    expect(md).toContain('| Name | Value |')
    expect(md).toContain('| A | 1 |')
  })

  it('returns extraction results', async () => {
    const res = await SELF.fetch('http://localhost/result', {
      method: 'POST',
      body: '<html><head><title>Test</title></head><body><h1>Main Title</h1><h2>Sub</h2><p>Content</p></body></html>',
    })
    const data = await res.json() as { markdown: string, extracted: { tagName: string, textContent: string }[] }
    expect(data.markdown).toContain('# Main Title')
    expect(data.extracted).toBeDefined()
    expect(data.extracted.length).toBeGreaterThan(0)
    expect(data.extracted[0].tagName).toBe('h1')
  })

  it('handles streaming conversion', async () => {
    const res = await SELF.fetch('http://localhost/stream', {
      method: 'POST',
      body: '<h1>Stream</h1><p>Chunked content that should be processed incrementally.</p><ul><li>One</li><li>Two</li></ul>',
    })
    const md = await res.text()
    expect(md).toContain('# Stream')
    expect(md).toContain('- One')
    expect(md).toContain('- Two')
  })

  it('handles large documents', async () => {
    let html = ''
    for (let i = 0; i < 200; i++) {
      html += `<p>Paragraph ${i} with content.</p>`
    }
    const res = await SELF.fetch('http://localhost/convert', {
      method: 'POST',
      body: html,
    })
    const md = await res.text()
    expect(md).toContain('Paragraph 0')
    expect(md).toContain('Paragraph 199')
  })

  it('handles empty input', async () => {
    const res = await SELF.fetch('http://localhost/convert', {
      method: 'POST',
      body: '',
    })
    const md = await res.text()
    expect(md).toBe('')
  })

  it('handles HTML entities', async () => {
    const res = await SELF.fetch('http://localhost/convert', {
      method: 'POST',
      body: '<p>&amp; &lt; &gt; &quot;</p>',
    })
    const md = await res.text()
    expect(md).toContain('& < > "')
  })

  it('returns 404 for unknown routes', async () => {
    const res = await SELF.fetch('http://localhost/unknown')
    expect(res.status).toBe(404)
  })
})
