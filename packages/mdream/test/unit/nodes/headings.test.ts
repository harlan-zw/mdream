import { describe, expect, it } from 'vitest'
import { htmlToMarkdown } from '../../../src'

describe('headings', () => {
  it('converts h1', () => {
    const html = '<h1>Heading 1</h1>'
    const markdown = htmlToMarkdown(html)
    expect(markdown).toBe('# Heading 1')
  })

  it('converts h2', () => {
    const html = '<h2>Heading 2</h2>'
    const markdown = htmlToMarkdown(html)
    expect(markdown).toBe('## Heading 2')
  })

  it('converts h3', () => {
    const html = '<h3>Heading 3</h3>'
    const markdown = htmlToMarkdown(html)
    expect(markdown).toBe('### Heading 3')
  })

  it('converts h4', () => {
    const html = '<h4>Heading 4</h4>'
    const markdown = htmlToMarkdown(html)
    expect(markdown).toBe('#### Heading 4')
  })

  it('converts h5', () => {
    const html = '<h5>Heading 5</h5>'
    const markdown = htmlToMarkdown(html)
    expect(markdown).toBe('##### Heading 5')
  })

  it('converts h6', () => {
    const html = '<h6>Heading 6</h6>'
    const markdown = htmlToMarkdown(html)
    expect(markdown).toBe('###### Heading 6')
  })

  it('nested headers', () => {
    const html = '<a href="/test"><h1>Heading 1</h1></a><ul><li><h2>Heading 2</h2></li></ul>'
    const markdown = htmlToMarkdown(html)
    expect(markdown).toMatchInlineSnapshot(`
      "[<h1>Heading 1</h1>](/test)

      - ## Heading 2"
    `)
  })
})
