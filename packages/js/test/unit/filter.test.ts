import { describe, expect, it } from 'vitest'
import { htmlToMarkdown } from '../../src/index'
import { extractionPlugin } from '../../src/plugins/extraction.js'
import { filterPlugin } from '../../src/plugins/filter'

describe('filter plugin', () => {
  it.each([
    ['a[href="https://example.com"]', '<a href="https://example.com">selected</a>'],
    ['img[src$=".png"]', '<img src="image.png" alt="selected">'],
    ['a[href="#main"]', '<a href="#main">selected</a>'],
    ['a[href="/docs/[name].html#section"].active', '<a href="/docs/[name].html#section" class="active">selected</a>'],
  ])('filters and extracts %s', (selector, element) => {
    const html = `${element}<p>shown</p>`
    const extracted: string[] = []

    htmlToMarkdown(html, {
      plugins: [extractionPlugin({
        [selector]: node => extracted.push(node.name),
      })],
    })
    expect(extracted).toHaveLength(1)
    expect(htmlToMarkdown(html, {
      plugins: [filterPlugin({ exclude: [selector] })],
    })).toBe('shown')
  })

  it('skips an excluded subtree without hiding following siblings', () => {
    const html = '<div><nav><p>hidden <strong>nested</strong></p></nav><p>shown</p></div>'
    expect(htmlToMarkdown(html, {
      plugins: [filterPlugin({ exclude: ['nav'] })],
    })).toBe('shown')
  })

  it('propagates hidden styles through nested elements', () => {
    const html = '<div style="display:none"><p>hidden <strong>nested</strong></p></div><p>shown</p>'
    expect(htmlToMarkdown(html, {
      plugins: [filterPlugin()],
    })).toBe('shown')
  })

  // 40 was TAG_FORM, which v1 code passed in place of the tag name.
  it.each(['include', 'exclude'] as const)('rejects a tag id in %s', (key) => {
    const create = () => filterPlugin({ [key]: ['nav', 40 as unknown as string] })
    expect(create).toThrow(TypeError)
    expect(create).toThrow(`filterPlugin takes \`${key}\` entries as strings. Pass the tag name or a CSS selector, such as 'form'.`)
  })
})
