import { describe, expect, it, vi } from 'vitest'
import { htmlToMarkdown, streamHtmlToMarkdown } from '../../src'
import { resolveOptions } from '../../src/resolve-options'

async function collect(html: string, options: object): Promise<string> {
  let markdown = ''
  for await (const chunk of streamHtmlToMarkdown(new Response(html).body, options))
    markdown += chunk
  return markdown
}

describe('unknown options', () => {
  const page = '<html><head><title>Page</title></head><body><nav>Menu</nav><main><h1>Hi</h1></main></body></html>'

  it.each([
    [{ preset: 'minimal' }, 'mdream has no `preset` option. Pass { minimal: true }.'],
    [{ cleanUrls: true }, 'mdream has no `cleanUrls` option. Pass { clean: { urls: true } }.'],
    [{ plugins: { frontmatter: true } }, 'mdream takes plugin options at the top level, such as { frontmatter: true }.'],
    [{ plugins: [{}] }, 'Custom hook plugins require @mdream/js.'],
    [{ plugins: [] }, 'https://github.com/harlan-zw/mdream/tree/main/packages/js#migrating-from-v1'],
    [{ isolatemain: true }, 'mdream has no `isolatemain` option.'],
  ])('rejects %o and names the fix', (options, message) => {
    expect(() => htmlToMarkdown(page, options as any)).toThrow(TypeError)
    expect(() => htmlToMarkdown(page, options as any)).toThrow(message)
  })

  it('lists the valid options for a misspelled key', () => {
    expect(() => htmlToMarkdown(page, { wrapwidth: 80 } as any)).toThrow('isolateMain')
  })

  it('rejects them on the stream entry', async () => {
    await expect(collect(page, { preset: 'minimal' })).rejects.toThrow('Pass { minimal: true }')
  })

  it('ignores keys whose value is undefined', async () => {
    const options = { minimal: true, preset: undefined, cleanUrls: undefined, plugins: undefined }
    const expected = '---\ntitle: Page\n---\n\n# Hi'
    expect(htmlToMarkdown(page, options as any)).toBe(expected)
    expect(await collect(page, options)).toBe(expected)
  })
})

describe('url cleanup', () => {
  const html = '<main><p><a href="https://example.com/?utm_source=x&id=1">Link</a></p></main>'

  it.each([
    { clean: { urls: true } },
    { clean: true },
    { minimal: true },
  ])('%o strips tracking parameters', async (options) => {
    expect(htmlToMarkdown(html, options)).toBe('[Link](https://example.com/?id=1)')
    expect(await collect(html, options)).toBe('[Link](https://example.com/?id=1)')
  })

  it('keeps tracking parameters without clean', () => {
    expect(htmlToMarkdown(html)).toBe('[Link](https://example.com/?utm_source=x&id=1)')
  })
})

describe('htmlToMarkdown resolve options', () => {
  it('minimal enables frontmatter, isolateMain, tailwind, filter', () => {
    const html = '<!DOCTYPE html><html><head><title>Edge Options</title></head><body><div>Outside chrome</div><main><nav>Inside nav</nav><h1>Real Content</h1><p><a href="#">Empty link</a></p></main><footer>Footer junk</footer></body></html>'
    const md = htmlToMarkdown(html, {
      minimal: true,
      isolateMain: true,
      filter: { exclude: ['nav', 'footer'] },
    })
    expect(md).toBe('---\ntitle: "Edge Options"\n---\n\n# Real Content\n\nEmpty link')
  })

  it('minimal preserves explicit plugin opt-outs', () => {
    const { napiOpts } = resolveOptions({
      minimal: true,
      frontmatter: false,
      isolateMain: false,
      tailwind: false,
    })
    expect(napiOpts.plugins).not.toHaveProperty('frontmatter')
    expect(napiOpts.plugins).not.toHaveProperty('isolateMain')
    expect(napiOpts.plugins).not.toHaveProperty('tailwind')
  })

  it('clean: true enables all cleanup', () => {
    const html = `<p><a href="https://example.com">https://example.com</a></p>`
    const md = htmlToMarkdown(html, { clean: true })
    // redundantLinks should simplify [url](url) to just url
    expect(md).toContain('https://example.com')
    expect(md).not.toContain('[https://example.com](https://example.com)')
  })

  it('frontmatter callback receives extracted data', () => {
    const cb = vi.fn()
    const html = `<html><head><title>Page</title></head><body><p>Content</p></body></html>`
    htmlToMarkdown(html, { frontmatter: cb })
    expect(cb).toHaveBeenCalledOnce()
    expect(cb).toHaveBeenCalledWith(expect.objectContaining({ title: expect.any(String) }))
  })

  it('frontmatter config object with onExtract', () => {
    const cb = vi.fn()
    const html = `<html><head><title>Page</title></head><body><p>Content</p></body></html>`
    htmlToMarkdown(html, { frontmatter: { onExtract: cb } })
    expect(cb).toHaveBeenCalledOnce()
  })

  it('extraction handlers receive matched elements', () => {
    const cb = vi.fn()
    const html = `<h2>Section Title</h2><p>Content</p>`
    htmlToMarkdown(html, { extraction: { h2: cb } })
    expect(cb).toHaveBeenCalledOnce()
    expect(cb).toHaveBeenCalledWith(expect.objectContaining({
      selector: 'h2',
      textContent: expect.stringContaining('Section Title'),
    }))
  })

  it('tagOverrides string shorthand acts as alias', () => {
    const html = `<custom-tag>content</custom-tag>`
    const md = htmlToMarkdown(html, { tagOverrides: { 'custom-tag': 'strong' } })
    expect(md).toContain('**content**')
  })

  it('streamHtmlToMarkdown throws on null stream', async () => {
    const { streamHtmlToMarkdown } = await import('../../src')
    const gen = streamHtmlToMarkdown(null as any)
    await expect(async () => {
      for await (const _ of gen) { /* noop */ }
    }).rejects.toThrow('Invalid HTML stream')
  })
})
