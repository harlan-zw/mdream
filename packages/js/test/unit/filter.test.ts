import { describe, expect, it } from 'vitest'
import { htmlToMarkdown } from '../../src/index'
import { filterPlugin } from '../../src/plugins/filter'

describe('filter plugin', () => {
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
