import { describe, expect, it } from 'vitest'
import { engines, htmlToMarkdown, resolveEngine } from '../../utils/engines'

describe.each(engines)('text Formatting $name', (engineConfig) => {
  it('converts bold text with <strong>', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = '<p>This is <strong>bold</strong> text</p>'
    const markdown = htmlToMarkdown(html, { engine })
    expect(markdown).toBe('This is **bold** text')
  })

  it('converts bold text with <b>', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = '<p>This is <b>bold</b> text</p>'
    const markdown = htmlToMarkdown(html, { engine })
    expect(markdown).toBe('This is **bold** text')
  })

  it('converts italic text with <em>', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = '<p>This is <em>italic</em> text</p>'
    const markdown = htmlToMarkdown(html, { engine })
    expect(markdown).toBe('This is _italic_ text')
  })

  it('converts italic text with <i>', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = '<p>This is <i>italic</i> text</p>'
    const markdown = htmlToMarkdown(html, { engine })
    expect(markdown).toBe('This is _italic_ text')
  })

  it('handles nested formatting', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    const html = '<p>This is <strong><em>bold and italic</em></strong> text</p>'
    const markdown = htmlToMarkdown(html, { engine })
    expect(markdown).toBe('This is **_bold and italic_** text')
  })
})

// Top-level text nodes (no block ancestor) used to be dropped (issue #93).
describe.each(engines)('top-level inline text $name', (engineConfig) => {
  it('keeps text before a top-level inline tag', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    expect(htmlToMarkdown('foo <em>bar</em>', { engine })).toBe('foo _bar_')
  })

  it('keeps text between top-level inline tags', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    expect(htmlToMarkdown('<strong>a</strong> and <em>b</em>', { engine })).toBe('**a** and _b_')
  })

  it('keeps text between repeated top-level inline tags', async () => {
    const engine = await resolveEngine(engineConfig.engine)
    expect(htmlToMarkdown('a<strong>b</strong>c<strong>d</strong>', { engine })).toBe('a**b**c**d**')
  })
})
