import type { ElementNode } from '../../../src/types.ts'
import { ELEMENT_NODE } from '@mdream/engine-js'
import { describe, expect, it } from 'vitest'
import { htmlToMarkdown } from '../../../src/index.ts'
import { withMinimalPreset } from '../../../src/preset/minimal.ts'

describe('plugin skip override', () => {
  it('user plugin runs before filter in minimal preset', () => {
    const seen: string[] = []
    const html = '<html><body><main><figure><img src="x.jpg" alt="test"></figure></main></body></html>'
    const options = withMinimalPreset({
      transforms: [{
        beforeNodeProcess(event) {
          if (event.node.type === ELEMENT_NODE) {
            seen.push((event.node as ElementNode).name)
          }
        },
      }],
    })
    htmlToMarkdown(html, options)
    expect(seen).toContain('figure')
  })

  it('figure is not excluded in minimal preset', () => {
    const html = '<html><body><main><figure><img src="photo.jpg" alt="test"><figcaption>Caption</figcaption></figure></main></body></html>'
    const markdown = htmlToMarkdown(html, withMinimalPreset())
    expect(markdown).toContain('![test](photo.jpg)')
    expect(markdown).toContain('_Caption_')
  })

  it('user onNodeEnter works for figure elements', () => {
    const figures: string[] = []
    const html = '<html><body><main><figure><img src="photo.jpg" alt="test"></figure></main></body></html>'
    const options = withMinimalPreset({
      transforms: [{
        onNodeEnter(node) {
          if (node.name === 'figure') {
            figures.push(node.name)
          }
        },
      }],
    })
    htmlToMarkdown(html, options)
    expect(figures).toContain('figure')
  })
})
