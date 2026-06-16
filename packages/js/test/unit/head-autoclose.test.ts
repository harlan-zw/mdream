import { describe, expect, it } from 'vitest'
import { htmlToMarkdown } from '../../src/index'

// Browser recovery: a page that never closes <head> (no </head>/<body>) parses
// its body content inside <head>, which collapses all block spacing to a single
// line. The parser auto-closes head on the first non-head start tag, matching the
// HTML "in head" insertion mode. Regression for marketingexamples.com pages.
describe('unclosed <head> auto-close', () => {
  it('produces the same output as the well-formed equivalent', () => {
    const broken = '<html><head><title>t</title><meta charset="utf-8"><div><h1>Title</h1><p>para one</p><h2>Heading</h2><p>para two</p></div></html>'
    const wellFormed = '<html><head><title>t</title><meta charset="utf-8"></head><body><div><h1>Title</h1><p>para one</p><h2>Heading</h2><p>para two</p></div></body></html>'
    expect(htmlToMarkdown(broken)).toBe(htmlToMarkdown(wellFormed))
    expect(htmlToMarkdown(broken)).toContain('# Title\n\npara one\n\n## Heading\n\npara two')
  })

  it('keeps head metadata in head until flow content appears', () => {
    const html = '<head><title>t</title><link rel="x"><style>a{}</style><p>body text</p>'
    expect(htmlToMarkdown(html)).toBe('t\n\nbody text')
  })

  it('does not keep body in head context for duplicated <head>', () => {
    // A second <head> closes the first, so the trailing <p> is body flow.
    const html = '<head><head><title>t</title><p>body text</p>'
    expect(htmlToMarkdown(html)).toBe('t\n\nbody text')
  })
})
