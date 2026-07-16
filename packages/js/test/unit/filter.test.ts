import { describe, expect, it } from 'vitest'
import { TAG_NAV } from '../../src/const'
import { htmlToMarkdown } from '../../src/index'

describe('filter plugin', () => {
  it('skips an excluded subtree without hiding following siblings', () => {
    const html = '<div><nav><p>hidden <strong>nested</strong></p></nav><p>shown</p></div>'
    expect(htmlToMarkdown(html, {
      plugins: { filter: { exclude: [TAG_NAV] } },
    })).toBe('shown')
  })

  it('propagates hidden styles through nested elements', () => {
    const html = '<div style="display:none"><p>hidden <strong>nested</strong></p></div><p>shown</p>'
    expect(htmlToMarkdown(html, {
      plugins: { filter: {} },
    })).toBe('shown')
  })
})
