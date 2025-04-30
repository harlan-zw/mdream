import { describe, expect, it } from 'vitest'
import { syncHtmlToMarkdown } from '../../../src'

describe('headings', () => {
  it('converts h1', async () => {
    const html = '<h1>Heading 1</h1>'
    const markdown = syncHtmlToMarkdown(html)
    expect(markdown).toBe('# Heading 1')
  })

  it('converts h2', async () => {
    const html = '<h2>Heading 2</h2>'
    const markdown = syncHtmlToMarkdown(html)
    expect(markdown).toBe('## Heading 2')
  })

  it('converts h3', async () => {
    const html = '<h3>Heading 3</h3>'
    const markdown = syncHtmlToMarkdown(html)
    expect(markdown).toBe('### Heading 3')
  })

  it('converts h4', async () => {
    const html = '<h4>Heading 4</h4>'
    const markdown = syncHtmlToMarkdown(html)
    expect(markdown).toBe('#### Heading 4')
  })

  it('converts h5', async () => {
    const html = '<h5>Heading 5</h5>'
    const markdown = syncHtmlToMarkdown(html)
    expect(markdown).toBe('##### Heading 5')
  })

  it('converts h6', async () => {
    const html = '<h6>Heading 6</h6>'
    const markdown = syncHtmlToMarkdown(html)
    expect(markdown).toBe('###### Heading 6')
  })
})
