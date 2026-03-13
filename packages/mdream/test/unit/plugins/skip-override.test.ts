import type { ElementNode } from '@mdream/js'
import { ELEMENT_NODE, htmlToMarkdown, withMinimalPreset } from '@mdream/js'
import { describe, expect, it } from 'vitest'

describe('plugin skip override', () => {
  it('user plugin runs before filter in minimal preset', () => {
    const seen: string[] = []
    const html = '<html><body><main><figure><img src="x.jpg" alt="test"></figure></main></body></html>'
    const options = withMinimalPreset({
      hooks: [{
        beforeNodeProcess(event) {
          if (event.node.type === ELEMENT_NODE) {
            seen.push((event.node as ElementNode).name)
          }
        },
      }],
    })
    htmlToMarkdown(html, options).markdown
    expect(seen).toContain('figure')
  })

  it('figure is not excluded in minimal preset', () => {
    const html = '<html><body><main><figure><img src="photo.jpg" alt="test"><figcaption>Caption</figcaption></figure></main></body></html>'
    const markdown = htmlToMarkdown(html, withMinimalPreset()).markdown
    expect(markdown).toContain('![test](photo.jpg)')
    expect(markdown).toContain('_Caption_')
  })

  it('user onNodeEnter works for figure elements', () => {
    const figures: string[] = []
    const html = '<html><body><main><figure><img src="photo.jpg" alt="test"></figure></main></body></html>'
    const options = withMinimalPreset({
      hooks: [{
        onNodeEnter(node) {
          if (node.name === 'figure') {
            figures.push(node.name)
          }
        },
      }],
    })
    htmlToMarkdown(html, options).markdown
    expect(figures).toContain('figure')
  })
})
